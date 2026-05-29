import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function PATCH(request: Request) {
  try {
    const serverSupabase = await createServerClient()
    const { data: { user } } = await serverSupabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: moi } = await adminSupabase
      .from('employes')
      .select('role, departement_id')
      .eq('auth_user_id', user.id)
      .single()

    if (!moi || !['admin', 'gestionnaire'].includes(moi.role)) {
      return NextResponse.json({ error: 'Acces refuse' }, { status: 403 })
    }

    const body = await request.json()
    const { id, actif } = body
    if (!id || typeof actif !== 'boolean') {
      return NextResponse.json({ error: 'Parametres invalides' }, { status: 400 })
    }

    // Si gestionnaire : vérifier que l'employé cible est dans son département
    if (moi.role === 'gestionnaire') {
      const { data: cible } = await adminSupabase
        .from('employes')
        .select('departement_id')
        .eq('id', id)
        .single()
      if (!cible || cible.departement_id !== moi.departement_id) {
        return NextResponse.json({ error: 'Acces refuse - hors de votre departement' }, { status: 403 })
      }
    }

    // Si on archive, invalider la session de l'employé
    if (!actif) {
      const { data: emp } = await adminSupabase
        .from('employes')
        .select('auth_user_id')
        .eq('id', id)
        .single()
      if (emp?.auth_user_id) {
        await adminSupabase.auth.admin.signOut(emp.auth_user_id)
      }
    }

    const { error } = await adminSupabase
      .from('employes')
      .update({ actif })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true, actif })
  } catch (err) {
    console.error('toggle-employe-actif error:', err)
    return NextResponse.json({ error: 'Erreur serveur interne' }, { status: 500 })
  }
}
