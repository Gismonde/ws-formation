import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getActeur, serviceClient } from '@/lib/permissions'
import { lireFiltresAudit, employesConcernes, requeteAudit } from '@/lib/audit-journal'
import { estAdministrateur } from '@/lib/cliniques'

export async function GET(request: NextRequest) {
  // Journal d'audit : administrateurs seulement, limité à leur périmètre
  const acteur = await getActeur()
  if (!acteur) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!estAdministrateur(acteur.role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const sb = serviceClient()
  const sp = new URL(request.url).searchParams
  const filtres = lireFiltresAudit(sp)
  const page = Math.max(1, parseInt(sp.get('page') || '1') || 1)
  const limit = Math.min(200, Math.max(1, parseInt(sp.get('limit') || '50') || 50))

  const employes = await employesConcernes(sb, acteur, filtres)
  const q = requeteAudit(sb, filtres, employes?.map(e => e.id) ?? null, { compter: true })
  if (!q) return NextResponse.json({ logs: [], count: 0, page, limit })
  const { data: logs, error, count } = await q.range((page - 1) * limit, page * limit - 1)
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
