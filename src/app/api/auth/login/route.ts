import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies'

export async function POST(request: Request) {
  const formData = await request.formData()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const cookiesToSet: { name: string; value: string; options: Partial<ResponseCookie> }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return [] },
        setAll(cookies) {
          cookiesToSet.push(...cookies)
        },
      },
    }
  )

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return NextResponse.redirect(new URL('/login?error=1', request.url), { status: 303 })
  }

  // Check if employee is archived (actif = false)
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: employe } = await supabase
      .from('employes')
      .select('actif')
      .eq('auth_user_id', user.id)
      .single()

    if (employe && employe.actif === false) {
      // Sign out the archived user and redirect with error
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL('/login?error=archived', request.url), { status: 303 })
    }
  }

  const response = NextResponse.redirect(new URL('/dashboard', request.url), { status: 303 })

  for (const { name, value, options } of cookiesToSet) {
    response.cookies.set(name, value, options)
  }

  return response
}
