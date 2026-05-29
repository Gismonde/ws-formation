import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

export async function POST(request: Request) {
  // Verify the requesting user is an admin
  const serverSupabase = await createServerClient()
  const { data: { user } } = await serverSupabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
  }

  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: emp } = await adminSupabase
    .from('employes')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single()

  if (!emp || emp.role !== 'admin') {
    return NextResponse.json({ error: 'Acces refuse' }, { status: 403 })
  }

  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null
  const ua = request.headers.get('user-agent') ?? null

  const body = await request.json()
  const { prenom, nom, email, password, role, departement_id, poste } = body

  if (!prenom || !nom || !email || !password) {
    return NextResponse.json({ error: 'Champs obligatoires manquants' }, { status: 400 })
  }

  // Create auth user
  const { data: newUser, error: authError } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { prenom, nom }
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  // Insert into employes table
  const { data: newEmp, error: empError } = await adminSupabase
    .from('employes')
    .insert({
      auth_user_id: newUser.user.id,
      prenom,
      nom,
      email,
      role: role || 'employe',
      departement_id: departement_id || null,
      poste: poste || null,
      actif: true
    })
    .select('id')
    .single()

  if (empError) {
    // Rollback: delete the auth user
    await adminSupabase.auth.admin.deleteUser(newUser.user.id)
    return NextResponse.json({ error: empError.message }, { status: 400 })
  }

  // Log audit event
  await logAudit({
    acteur_id: emp.id,
    type_action: 'EMPLOYE_CREE',
    description: 'Nouvel employe cree : ' + prenom + ' ' + nom + ' (' + email + ')',
    cible_employe_id: newEmp?.id ?? null,
    ip_address: ip,
    user_agent: ua,
  })

  return NextResponse.json({ success: true, userId: newUser.user.id })
}
