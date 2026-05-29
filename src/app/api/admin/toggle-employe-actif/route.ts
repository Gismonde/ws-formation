import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function PATCH(request: Request) {
  try {
    // Verify the requesting user is an admin or gestionnaire
    const serverSupabase = await createServerClient()
    const { data: { user } } = await serverSupabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    const { data: adminEmp } = await serverSupabase
      .from('employes')
      .select('role')
      .eq('auth_user_id', user.id)
      .single()

    if (!adminEmp || !['admin', 'gestionnaire'].includes(adminEmp.role)) {
      return NextResponse.json({ error: 'Acces refuse' }, { status: 403 })
    }

    const body = await request.json()
    const { id, actif } = body

    if (!id || typeof actif !== 'boolean') {
      return NextResponse.json({ error: 'Parametres invalides' }, { status: 400 })
    }

    // Use service role client to bypass RLS for the update
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await supabaseAdmin
      .from('employes')
      .update({ actif, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // If archiving, also sign out the user from Supabase Auth
    if (!actif) {
      // Get the auth_user_id for this employee
      const { data: emp } = await supabaseAdmin
        .from('employes')
        .select('auth_user_id')
        .eq('id', id)
        .single()

      if (emp?.auth_user_id) {
        await supabaseAdmin.auth.admin.signOut(emp.auth_user_id)
      }
    }

    return NextResponse.json({ success: true, actif })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erreur serveur' }, { status: 500 })
  }
}
