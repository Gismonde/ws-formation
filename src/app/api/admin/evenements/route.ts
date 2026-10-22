// Création d'un événement (brouillon) avec ses séances. POST — administrateurs et gestionnaires autorisés.
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, peutCreerEvenements, ipEtAgent } from '@/lib/permissions'
import { validerEvenement, validerSeance } from '@/lib/evenements-admin'
import { logAudit } from '@/lib/audit'

export async function POST(req: Request) {
  const acteur = await getActeur()
  if (!acteur || !peutCreerEvenements(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const c = await req.json().catch(() => ({})) as Record<string, unknown>
  const v = validerEvenement(acteur, c)
  if ('erreur' in v) return NextResponse.json({ error: v.erreur }, { status: 400 })
  const seances = Array.isArray(c.seances) ? (c.seances as Record<string, unknown>[]) : []
  const valides = []
  for (const s of seances) {
    const r = validerSeance(s)
    if ('erreur' in r) return NextResponse.json({ error: r.erreur }, { status: 400 })
    valides.push(r.valeurs)
  }
  const sb = serviceClient()
  const { data: ev, error } = await sb.from('evenements').insert({ ...v.valeurs, statut: 'brouillon', cree_par: acteur.id }).select('id, titre').single()
  if (error || !ev) return NextResponse.json({ error: error?.message ?? 'Erreur' }, { status: 500 })
  if (valides.length) {
    const { error: e2 } = await sb.from('evenements_seances').insert(valides.map(s => ({ ...s, evenement_id: ev.id })))
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
  }
  await logAudit({ acteur_id: acteur.id, type_action: 'FORMATION_CREEE', description: `Événement créé (brouillon) : ${ev.titre} — ${valides.length} séance(s)`, metadata: { evenement_id: ev.id }, ...ipEtAgent(req) })
  return NextResponse.json({ id: ev.id })
}
