import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session - required for Server Components
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Routes nécessitant une authentification
  const protectedPaths = ['/dashboard', '/formations', '/admin', '/certificats']
  const isProtected = protectedPaths.some(p => pathname.startsWith(p))

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  // Si connecté, vérifier le rôle pour les routes sensibles
  if (user) {
    const { data: employe } = await supabase
      .from('employes')
      .select('role')
      .eq('auth_user_id', user.id)
      .single()

    const role = employe?.role

    // Les admins/gestionnaires accèdent à /admin, pas aux pages employé
    const isEmployeeRoute = pathname.startsWith('/dashboard') || pathname.startsWith('/formations')
    const isAdminRoute = pathname.startsWith('/admin')

    if (isEmployeeRoute && (role === 'admin' || role === 'gestionnaire')) {
      const adminUrl = request.nextUrl.clone()
      adminUrl.pathname = '/admin'
      return NextResponse.redirect(adminUrl)
    }

    // Les employés n'ont pas accès à /admin
    if (isAdminRoute && role === 'employe') {
      const dashboardUrl = request.nextUrl.clone()
      dashboardUrl.pathname = '/dashboard'
      return NextResponse.redirect(dashboardUrl)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
