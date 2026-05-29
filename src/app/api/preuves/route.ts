import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: employe } = await serviceClient
    .from('employes')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single()

  if (!employe) return NextResponse.json({ error: 'Employé non trouvé' }, { status: 404 })

  const searchParams = request.nextUrl.searchParams
  const formationId = searchParams.get('formation_id')
  const employeId = searchParams.get('employe_id')

  let query = serviceClient
    .from('preuves_externes')
    .select('*')
    .order('soumis_le', { ascending: false })

  // If not admin/gestionnaire, only show own proofs
  if (!['admin', 'gestionnaire'].includes(employe.role)) {
    query = query.eq('employe_id', employe.id)
  } else if (employeId) {
    query = query.eq('employe_id', employeId)
  }

  if (formationId) {
    query = query.eq('formation_id', formationId)
  }

  const { data: preuves, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ preuves })
}
