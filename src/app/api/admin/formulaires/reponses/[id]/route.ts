// Traitement d'une réponse.
//  - Administrateurs : statut, note interne, réponse à l'employé, section réservée.
//  - Destinataires (ex. gestionnaire du département) : section réservée (et « complété »), réponse à l'employé.
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, ipEtAgent } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { origineDepuis } from '@/lib/courriels'
import { peutVoirReponses, voitTout, validerReponses, numeroReponse, type Champ, type Formulaire, type StatutReponse } from '@/lib/formulaires'
import { avertirEmploye } from '@/lib/formulaires-serveur'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await getActeur()
  if (!a) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const sb = serviceClient()
  const { data: r } = await sb.from('formulaire_reponses').select('id, numero, formulaire_id, definition, statut, employe_id, anonyme').eq('id', (await params).id).maybeSingle()
  const { data: f } = r ? await sb.from('formulaires').select('*').eq('id', r.formulaire_id).maybeSingle() : { data: null }
  if (!r || !f || !peutVoirReponses(a, f as Formulaire)) return NextResponse.json({ error: 'Réponse introuvable' }, { status: 404 })
  const admin = voitTout(a, f as Formulaire)

  const b = await req.json().catch(() => ({})) as { statut?: StatutReponse; note_interne?: string; reserve?: Record<string, unknown>; completer?: boolean; reponse_employe?: string }
  const maj: Record<string, unknown> = {}
  const faits: string[] = []
  const maintenant = new Date().toISOString()
  if (b.statut !== undefined) {
    if (!admin) return NextResponse.json({ error: 'Seuls les administrateurs modifient le statut' }, { status: 403 })
    if (!['recu', 'en_traitement', 'traite'].includes(b.statut)) return NextResponse.json({ error: 'Statut inconnu' }, { status: 400 })
    if (b.statut !== r.statut) {
      Object.assign(maj, { statut: b.statut, statut_le: maintenant, traite_par: a.id, traite_le: b.statut === 'traite' ? maintenant : null })
      faits.push(`statut « ${b.statut} »`)
    }
  }
  if (typeof b.note_interne === 'string') {
    if (!admin) return NextResponse.json({ error: 'Note interne réservée aux administrateurs' }, { status: 403 })
    maj.note_interne = b.note_interne.slice(0, 8000) || null; faits.push('note interne')
  }
  if (b.reserve !== undefined) {
    const v = validerReponses(((r.definition as { champs?: Champ[] })?.champs ?? []), b.reserve, 'reserve')
    if ('erreur' in v) return NextResponse.json({ error: v.erreur }, { status: 400 })
    maj.reserve = v.valeurs; faits.push('section réservée')
  }
  if (b.completer === true) { Object.assign(maj, { reserve_complete_le: maintenant, reserve_complete_par: a.id }); faits.push('marqué « complété »') }
  if (b.completer === false) { Object.assign(maj, { reserve_complete_le: null, reserve_complete_par: null }); faits.push('« complété » retiré') }
  if (typeof b.reponse_employe === 'string') {
    if (r.anonyme || !r.employe_id) return NextResponse.json({ error: 'Envoi anonyme : aucune réponse ne peut être transmise à l’employé' }, { status: 400 })
    const txt = b.reponse_employe.trim().slice(0, 8000)
    Object.assign(maj, { reponse_employe: txt || null, reponse_le: txt ? maintenant : null }); faits.push('réponse à l’employé')
  }
  if (!Object.keys(maj).length) return NextResponse.json({ ok: true })
  const { error } = await sb.from('formulaire_reponses').update(maj).eq('id', r.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({
    acteur_id: a.id, type_action: 'FORMULAIRE_TRAITE',
    description: `Formulaire « ${(f as Formulaire).titre} » ${numeroReponse(r.numero)} : ${faits.join(', ')}`,
    metadata: { reponse_id: r.id, formulaire_id: r.formulaire_id }, ...ipEtAgent(req),
  })
  // L'employé est avisé d'un changement de statut ou d'une réponse
  try {
    if (maj.statut) await avertirEmploye(sb, r, { statut: maj.statut as StatutReponse }, origineDepuis(req))
    if (maj.reponse_employe) await avertirEmploye(sb, r, { reponse: true }, origineDepuis(req))
  } catch (e) { console.error('[formulaires] courriel employé', e) }
  return NextResponse.json({ ok: true })
}
