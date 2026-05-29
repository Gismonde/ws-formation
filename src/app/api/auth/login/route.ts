import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies'
import { logAudit } from '@/lib/audit'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
    const formData = await request.formData()
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null
    const userAgent = request.headers.get('user-agent') ?? null

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
        // Log connexion échouée
      const serviceClient = createServiceClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
            )
        const { data: emp } = await serviceClient
          .from('employes')
          .select('id')
          .eq('email', email)
          .single()
        if (emp) {
                await logAudit({
                          acteur_id: emp.id,
                          type_action: 'CONNEXION_ECHOUEE',
                          description: `Tentative de connexion échouée pour ${email}`,
                          ip_address: ip,
                          user_agent: userAgent,
                })
        }
        return NextResponse.redirect(new URL('/login?error=1', request.url), { status: 303 })
  }

  // Check if employee is archived (actif = false)
  const { data: { user } } = await supabase.auth.getUser()
    if (user) {
          const { data: employe } = await supabase
            .from('employes')
            .select('id, actif')
            .eq('auth_user_id', user.id)
            .single()

      if (employe && employe.actif === false) {
              await supabase.auth.signOut()
              return NextResponse.redirect(new URL('/login?error=archived', request.url), { status: 303 })
      }

      if (employe) {
              await logAudit({
                        acteur_id: employe.id,
                        type_action: 'CONNEXION',
                        description: `Connexion réussie pour ${email}`,
                        ip_address: ip,
                        user_agent: userAgent,
              })
      }
    }

  const response = NextResponse.redirect(new URL('/dashboard', request.url), { status: 303 })

  for (const { name, value, options } of cookiesToSet) {
        response.cookies.set(name, value, options)
  }

  return response
}
