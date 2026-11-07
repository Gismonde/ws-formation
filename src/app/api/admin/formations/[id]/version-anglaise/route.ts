// Relie une formation française à sa version anglaise (ou retire le lien).
// Les employés dont la langue de formation est l'anglais reçoivent alors la version anglaise.
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, cliniquesContenuGerablesToutes, ipEtAgent } from '@/lib/permissions'
import { lierVersionAnglaise, versionsCompatibles } from '@/lib/langues-formation'
import { logAudit } from '@/lib/audit'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await getActeur()
  if (!a || (a.role !== 'super_admin' && a.role !== 'admin')) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const { id } = await params
  const corps = await req.json().catch(() => ({}))
  const anglaiseId: string | null = typeof corps.anglaise_id === 'string' && UUID.test(corps.anglaise_id) ? corps.anglaise_id : null
  if (corps.anglaise_id && !anglaiseId) return NextResponse.json({ error: 'Formation invalide' }, { status: 400 })
  if (anglaiseId === id) return NextResponse.json({ error: 'Choisissez une autre formation' }, { status: 400 })

  const sb = serviceClient()
  const gerables = cliniquesContenuGerablesToutes(a) as string[]
  const { data: fs, error } = await sb.from('formations').select('id, titre, clinique, langue, version_de').in('id', anglaiseId ? [id, anglaiseId] : [id])
  if (error) return NextResponse.json({ error: /langue|version_de/.test(error.message) ? 'Exécutez d’abord supabase/migrations/langues_formation.sql dans Supabase.' : error.message }, { status: 400 })
  const fr = (fs ?? []).find(f => f.id === id)
  const en = anglaiseId ? (fs ?? []).find(f => f.id === anglaiseId) : null
  if (!fr || (anglaiseId && !en)) return NextResponse.json({ error: 'Formation introuvable' }, { status: 404 })
  for (const f of [fr, en].filter(Boolean)) {
    if (!gerables.includes((f!.clinique ?? 'LES_DEUX') as string)) return NextResponse.json({ error: 'Hors de votre périmètre' }, { status: 403 })
  }
  if (fr.version_de) return NextResponse.json({ error: 'Cette formation est elle-même une version anglaise' }, { status: 400 })
  if (en) {
    if (!versionsCompatibles(fr, en)) return NextResponse.json({ error: 'Les deux versions doivent appartenir à la même clinique' }, { status: 400 })
    if (en.version_de && en.version_de !== id) return NextResponse.json({ error: 'Cette formation est déjà la version anglaise d’une autre formation' }, { status: 400 })
    const { count } = await sb.from('formations').select('id', { count: 'exact', head: true }).eq('version_de', en.id)
    if ((count ?? 0) > 0) return NextResponse.json({ error: 'Cette formation a elle-même une version liée' }, { status: 400 })
  }

  const err = await lierVersionAnglaise(sb, id, anglaiseId)
  if (err) return NextResponse.json({ error: err }, { status: 400 })
  await logAudit({
    acteur_id: a.id, type_action: 'FORMATION_MODIFIEE', formation_id: id,
    description: en ? `Version anglaise reliée : « ${en.titre} » → « ${fr.titre} »` : `Version anglaise retirée de « ${fr.titre} »`,
    metadata: { version_anglaise: anglaiseId }, ...ipEtAgent(req),
  })
  return NextResponse.json({ ok: true })
}
