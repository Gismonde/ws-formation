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

  const { data: admin } = await serviceClient
    .from('employes')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single()

  if (!admin || !['admin', 'gestionnaire'].includes(admin.role)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const employe_id = searchParams.get('employe_id')
  const formation_id = searchParams.get('formation_id')
  const departement = searchParams.get('departement')
  const type_action = searchParams.get('type_action')
  const date_debut = searchParams.get('date_debut')
  const date_fin = searchParams.get('date_fin')
  const search = searchParams.get('search')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = (page - 1) * limit

  let query = serviceClient
    .from('audit_logs')
    .select(`
      *,
      acteur:employes!audit_logs_acteur_id_fkey(id, prenom, nom, email, role, departement),
      cible:employes!audit_logs_cible_employe_id_fkey(id, prenom, nom, email)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (employe_id) query = query.or(`acteur_id.eq.${employe_id},cible_employe_id.eq.${employe_id}`)
  if (formation_id) query = query.eq('formation_id', formation_id)
  if (type_action) query = query.eq('type_action', type_action)
  if (date_debut) query = query.gte('created_at', date_debut)
  if (date_fin) query = query.lte('created_at', date_fin + 'T23:59:59Z')
  if (search) query = query.or(`description.ilike.%${search}%,type_action.ilike.%${search}%`)

  if (departement) {
    const { data: empIds } = await serviceClient
      .from('employes')
      .select('id')
      .eq('departement', departement)
    const ids = empIds?.map((e: any) => e.id) ?? []
    if (ids.length > 0) query = query.in('acteur_id', ids)
    else return NextResponse.json({ logs: [], count: 0 })
  }

  const { data: logs, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ logs, count, page, limit })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const body = await request.json()

  const { data: acteur } = await serviceClient
    .from('employes')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (!acteur) return NextResponse.json({ error: 'Employé introuvable' }, { status: 404 })

  const { error } = await serviceClient
    .from('audit_logs')
    .insert({
      acteur_id: acteur.id,
      type_action: body.type_action,
      description: body.description,
      formation_id: body.formation_id ?? null,
      cible_employe_id: body.cible_employe_id ?? null,
      metadata: body.metadata ?? null,
      ip_address: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null,
      user_agent: request.headers.get('user-agent') ?? null,
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
