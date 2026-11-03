// Traitement d'une réponse : statut, note interne et sections réservées (personne qui reçoit, créateur, admin global).
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, ipEtAgent } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { peutVoirReponses, validerReponses, numeroReponse, type Champ, type Formulaire, type StatutReponse } from '@/lib/formulaires'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await getActeur()
  if (!a) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const sb = serviceClient()
  const { data: r } = await sb.from('formulaire_reponses').select('id, numero, formulaire_id, definition, statut').eq('id', (await params).id).maybeSingle()
  const { data: f } = r ? await sb.from('formulaires').select('*').eq('id', r.formulaire_id).maybeSingle() : { data: null }
  if (!r || !f || !peutVoirReponses(a, f as Formulaire)) return NextResponse.json({ error: 'Réponse introuvable' }, { status: 404 })

  const b = await req.json().catch(() => ({})) as { statut?: StatutReponse; note_interne?: string; reserve?: Record<string, unknown> }
  const maj: Record<string, unknown> = {}
  if (b.statut && ['recu', 'en_traitement', 'traite'].includes(b.statut)) {
    maj.statut = b.statut
    maj.traite_par = a.id
    maj.traite_le = b.statut === 'traite' ? new Date().toISOString() : null
  }
  if (typeof b.note_interne === 'string') maj.note_interne = b.note_interne.slice(0, 8000) || null
  if (b.reserve !== undefined) {
    const v = validerReponses(((r.definition as { champs?: Champ[] })?.champs ?? []), b.reserve, 'reserve')
    if ('erreur' in v) return NextResponse.json({ error: v.erreur }, { status: 400 })
    maj.reserve = v.valeurs
  }
  if (!Object.keys(maj).length) return NextResponse.json({ ok: true })
  const { error } = await sb.from('formulaire_reponses').update(maj).eq('id', r.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({
    acteur_id: a.id, type_action: 'FORMULAIRE_TRAITE',
    description: `Formulaire « ${(f as Formulaire).titre} » ${numeroReponse(r.numero)} : ${[maj.statut ? `statut « ${maj.statut} »` : '', b.reserve !== undefined ? 'section réservée mise à jour' : '', b.note_interne !== undefined ? 'note interne' : ''].filter(Boolean).join(', ')}`,
    metadata: { reponse_id: r.id, formulaire_id: r.formulaire_id }, ...ipEtAgent(req),
  })
  return NextResponse.json({ ok: true })
}
