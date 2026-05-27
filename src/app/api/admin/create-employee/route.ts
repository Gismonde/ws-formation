import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  // Verify the requesting user is an admin
  const serverSupabase = await createServerClient()
  const { data: { user } } = await serverSupabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
  }

  const { data: emp } = await serverSupabase
    .from('employes')
    .select('role')
    .eq('auth_user_id', user.id)
    .single()

  if (!emp || emp.role !== 'admin') {
    return NextResponse.json({ error: 'Acces refuse' }, { status: 403 })
  }

  // Use service role to create new user
  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

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
  const { error: empError } = await adminSupabase
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

  if (empError) {
    // Rollback: delete the auth user
    await adminSupabase.auth.admin.deleteUser(newUser.user.id)
    return NextResponse.json({ error: empError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, userId: newUser.user.id })
}
