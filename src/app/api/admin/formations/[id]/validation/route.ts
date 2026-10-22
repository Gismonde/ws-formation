// Validation d'une formation.
// GET  : statut, validateur, validateurs possibles.
// POST { action: 'demander', validateurId, message? } — créateur (droit de gérer la formation)
//      { action: 'annuler' }                          — créateur, tant que la demande est en attente
//      { action: 'approuver', commentaire? }          — le validateur désigné
//      { action: 'modifier', commentaire }            — le validateur désigné : demande des modifications
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, peutGererContenu, peutVoirContenu, ipEtAgent } from '@/lib/permissions'
import { aAccesAdmin } from '@/lib/cliniques'
import { logAudit } from '@/lib/audit'
import { envoyerCourriels, gabarit, origineDepuis } from '@/lib/courriels'
import { statutDe, validationActive, validateursPossibles, estValidateurPossible, type FormationValidation } from '@/lib/validation-formation'

async function charger(id: string) {
  const acteur = await getActeur()
  if (!acteur || !aAccesAdmin(acteur)) return { erreur: NextResponse.json({ error: 'Accès refusé' }, { status: 403 }) }
  const sb = serviceClient()
  const { data } = await sb.from('formations').select('*').eq('id', id).maybeSingle()
  const f = data as FormationValidation | null
  if (!f || !peutVoirContenu(acteur, f.clinique)) return { erreur: NextResponse.json({ error: 'Formation introuvable' }, { status: 404 }) }
  if (!validationActive(f)) return { erreur: NextResponse.json({ error: 'Validation non activée (migration manquante)' }, { status: 400 }) }
  return { acteur, sb, f }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await charger((await params).id)
  if ('erreur' in c) return c.erreur
  const validateurs = peutGererContenu(c.acteur, c.f.clinique) ? await validateursPossibles(c.sb, c.f, c.acteur.id) : []
  return NextResponse.json({ statut: statutDe(c.f), validateurs })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const c = await charger(id)
  if ('erreur' in c) return c.erreur
  const { acteur, sb, f } = c
  const corps = await req.json().catch(() => ({})) as { action?: string; validateurId?: string; message?: string; commentaire?: string }
  const statut = statutDe(f)
  const origine = origineDepuis(req)
  const lien = `${origine}/admin/formations/${id}`
  const maintenant = new Date().toISOString()
  const texte = (v: unknown) => String(v ?? '').trim().slice(0, 2000)
  const nomActeur = `${acteur.prenom ?? ''} ${acteur.nom ?? ''}`.trim()

  async function courriel(destId: string | null | undefined, sujet: string, paragraphes: string[], bouton: string) {
    if (!destId) return
    const { data: d } = await sb.from('employes').select('email, prenom, clinique').eq('id', destId).maybeSingle()
    if (!d?.email) return
    const { html, texte: t } = gabarit({ origine, clinique: d.clinique, titre: sujet, paragraphes: [`Bonjour ${d.prenom ?? ''},`.replace(' ,', ','), ...paragraphes], bouton: { libelle: bouton, lien } })
    await envoyerCourriels([{ a: d.email, sujet, html, texte: t }]).catch(() => null)
  }
  const journal = (description: string, metadata: Record<string, unknown>) =>
    logAudit({ acteur_id: acteur.id, formation_id: id, type_action: 'FORMATION_MODIFIEE', description, metadata: { historique: true, validation: true, ...metadata }, ...ipEtAgent(req) })

  if (corps.action === 'demander') {
    if (!peutGererContenu(acteur, f.clinique)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    if (statut === 'en_validation') return NextResponse.json({ error: 'Une demande de validation est déjà en cours.' }, { status: 400 })
    if (statut === 'approuvee') return NextResponse.json({ error: 'Cette version est déjà approuvée.' }, { status: 400 })
    const { data: v } = await sb.from('employes').select('*').eq('id', String(corps.validateurId ?? '')).maybeSingle()
    if (!v || !estValidateurPossible(v, f, acteur.id)) return NextResponse.json({ error: 'Validateur non autorisé pour cette formation (vous ne pouvez pas valider votre propre formation).' }, { status: 400 })
    const message = texte(corps.message)
    const { error } = await sb.from('formations').update({
      statut_validation: 'en_validation', validateur_id: v.id, validation_demandee_le: maintenant, validation_demandee_par: acteur.id,
      validation_commentaire: message || null,
    }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await journal(`Validation demandée à ${v.prenom ?? ''} ${v.nom ?? ''}`.trim() + (message ? ` : ${message}` : ''), { validateur: v.id })
    await courriel(v.id, `Formation à valider : ${f.titre}`, [`${nomActeur} vous demande de valider la formation « ${f.titre} » avant sa publication.`, ...(message ? [`Message : ${message}`] : [])], 'Voir la formation')
    return NextResponse.json({ ok: true })
  }

  if (corps.action === 'annuler') {
    if (!peutGererContenu(acteur, f.clinique) || statut !== 'en_validation') return NextResponse.json({ error: 'Aucune demande à annuler.' }, { status: 400 })
    await sb.from('formations').update({ statut_validation: 'brouillon', validateur_id: null }).eq('id', id)
    await journal('Demande de validation annulée', {})
    return NextResponse.json({ ok: true })
  }

  if (corps.action === 'approuver' || corps.action === 'modifier') {
    if (statut !== 'en_validation') return NextResponse.json({ error: 'Aucune validation en attente.' }, { status: 400 })
    if (f.validateur_id !== acteur.id) return NextResponse.json({ error: 'Seul le validateur désigné peut se prononcer.' }, { status: 403 })
    const commentaire = texte(corps.commentaire)
    if (corps.action === 'modifier' && !commentaire) return NextResponse.json({ error: 'Expliquez les modifications attendues.' }, { status: 400 })
    const approuve = corps.action === 'approuver'
    const { error } = await sb.from('formations').update({
      statut_validation: approuve ? 'approuvee' : 'a_modifier', validation_le: maintenant, validation_commentaire: commentaire || null,
      ...(approuve ? { validee_par: acteur.id } : {}),
    }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await journal(approuve ? `Formation approuvée par ${nomActeur}` + (commentaire ? ` : ${commentaire}` : '') : `Modifications demandées par ${nomActeur} : ${commentaire}`, { decision: approuve ? 'approuvee' : 'a_modifier' })
    await courriel(f.validation_demandee_par, approuve ? `Formation approuvée : ${f.titre}` : `Modifications demandées : ${f.titre}`,
      approuve
        ? [`${nomActeur} a approuvé la formation « ${f.titre} ». Vous pouvez maintenant la publier puis l’assigner.`, ...(commentaire ? [`Commentaire : ${commentaire}`] : [])]
        : [`${nomActeur} demande des modifications sur la formation « ${f.titre} » :`, commentaire, 'Une fois les modifications faites, renvoyez-la en validation.'],
      'Ouvrir la formation')
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
}
