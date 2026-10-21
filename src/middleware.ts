import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const CHEMINS_SANS_2FA = ['/mfa-verify', '/login', '/bienvenue', '/confidentialite']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Rafraîchit la session ; les rôles sont vérifiés dans chaque page / layout
  const { data: { user } } = await supabase.auth.getUser()

  // Double authentification activée : tant que le code n'est pas saisi, seule la page de vérification est accessible
  if (user && !CHEMINS_SANS_2FA.some(c => request.nextUrl.pathname === c || request.nextUrl.pathname.startsWith(c + '/'))) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
      const url = request.nextUrl.clone()
      url.pathname = '/mfa-verify'
      url.search = ''
      url.searchParams.set('suite', request.nextUrl.pathname + request.nextUrl.search)
      const redirection = NextResponse.redirect(url)
      supabaseResponse.cookies.getAll().forEach(c => redirection.cookies.set(c))
      return redirection
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
