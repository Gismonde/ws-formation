import { NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit'
import { getActeur, serviceClient, ipEtAgent } from '@/lib/permissions'
import { chargerEtatQuestionnaire, emettreCertificat } from '@/lib/questionnaire-serveur'
import { prerequisManquants, messagePrerequis } from '@/lib/prerequis'

/**
 * Correction du questionnaire côté serveur.
 * Le navigateur envoie seulement les réponses choisies ; la note, la réussite et le certificat sont décidés ici.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: formationId } = await params
  const acteur = await getActeur()
  if (!acteur) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const reponses = (body?.reponses ?? {}) as Record<string, string>
  const sb = serviceClient()

  // 1. La formation doit être publiée et assignée à l'employé
  const [{ data: formation }, { data: assignation }] = await Promise.all([
    sb.from('formations').select('id, titre, publiee').eq('id', formationId).single(),
    sb.from('assignations').select('id').eq('employe_id', acteur.id).eq('formation_id', formationId).limit(1).maybeSingle(),
  ])
  if (!formation || !formation.publiee) return NextResponse.json({ error: 'Formation introuvable' }, { status: 404 })
  if (!assignation) return NextResponse.json({ error: 'Cette formation ne vous est pas assignée.' }, { status: 403 })
  const manquants = await prerequisManquants(sb, acteur.id, formationId)
  if (manquants.length) return NextResponse.json({ error: messagePrerequis(manquants) }, { status: 403 })

  // 2. Conditions d'accès au questionnaire
  const etat = await chargerEtatQuestionnaire(sb, acteur.id, formationId)
  const q = etat.questionnaire
  if (!q) return NextResponse.json({ error: 'Aucun questionnaire pour cette formation' }, { status: 404 })
  if (!etat.formationTerminee) {
    return NextResponse.json({ error: `Terminez d’abord toute la formation (${etat.progressionPct} %).` }, { status: 400 })
  }
  if (etat.certificatValide) {
    return NextResponse.json({ error: 'Vous avez déjà un certificat valide pour cette formation.' }, { status: 400 })
  }
  if (etat.tentativesRestantes === 0) {
    return NextResponse.json({ error: 'Vous avez utilisé toutes vos tentatives. Contactez votre gestionnaire.' }, { status: 400 })
  }

  // 3. Correction (les bonnes réponses ne quittent jamais le serveur avant la réussite)
  const { data: questions } = await sb.from('questions')
    .select('id, points, ordre, reponses_possibles(id, est_correcte)')
    .eq('questionnaire_id', q.id).order('ordre')
  if (!questions || questions.length === 0) return NextResponse.json({ error: 'Questionnaire vide' }, { status: 400 })

  const manquantes = questions.filter(x => !reponses[x.id])
  if (manquantes.length > 0) return NextResponse.json({ error: `Répondez à toutes les questions (${manquantes.length} restante(s)).` }, { status: 400 })

  let obtenue = 0
  let maximale = 0
  const correction: Record<string, { correcte: boolean; bonne_reponse?: string }> = {}
  for (const question of questions) {
    const points = question.points && question.points > 0 ? question.points : 1
    const choix = (question.reponses_possibles ?? []).find(r => r.id === reponses[question.id])
    const bonne = (question.reponses_possibles ?? []).find(r => r.est_correcte)
    const correcte = !!choix && choix.est_correcte === true
    maximale += points
    if (correcte) obtenue += points
    correction[question.id] = { correcte, bonne_reponse: bonne?.id }
  }
  const score = maximale > 0 ? Math.round((obtenue / maximale) * 100) : 0
  const reussi = score >= q.note_passage

  // 4. Enregistrement de la tentative (preuve horodatée)
  const debut = typeof body?.debut === 'string' && !Number.isNaN(Date.parse(body.debut)) ? body.debut : null
  const { error: errT } = await sb.from('tentatives_questionnaire').insert({
    employe_id: acteur.id,
    questionnaire_id: q.id,
    numero_tentative: etat.tentatives.length + 1,
    note_obtenue: obtenue,
    note_maximale: maximale,
    reussi,
    date_debut: debut ?? new Date().toISOString(),
    date_fin: new Date().toISOString(),
    reponses_donnees: JSON.stringify(reponses),
  })
  if (errT) return NextResponse.json({ error: 'Enregistrement impossible : ' + errT.message }, { status: 500 })

  const reseau = ipEtAgent(request)
  await logAudit({
    acteur_id: acteur.id, cible_employe_id: acteur.id, formation_id: formationId,
    type_action: 'QUESTIONNAIRE_REPONSE',
    description: `Questionnaire « ${formation.titre} » : ${score} % (${reussi ? 'réussi' : 'échoué'}, seuil ${q.note_passage} %)`,
    metadata: { questionnaire_id: q.id, score, reussi, tentative: etat.tentatives.length + 1 },
    ...reseau,
  })

  // 5. Certificat
  let certificatId: string | null = null
  if (reussi) {
    const cert = await emettreCertificat(sb, acteur.id, formationId, score)
    certificatId = cert?.id ?? null
    await logAudit({
      acteur_id: acteur.id, cible_employe_id: acteur.id, formation_id: formationId,
      type_action: cert ? 'CERTIFICAT_OBTENU' : 'CERTIFICAT_ECHOUE',
      description: cert
        ? `Certificat ${cert.numero_certificat} émis pour « ${formation.titre} » (${score} %)`
        : `Échec de l’émission du certificat pour « ${formation.titre} »`,
      metadata: { certificat_id: cert?.id ?? null },
      ...reseau,
    })
  }

  const restantes = etat.tentativesRestantes === null ? null : etat.tentativesRestantes - 1
  return NextResponse.json({
    score,
    reussi,
    seuil: q.note_passage,
    certificatId,
    tentativesRestantes: restantes,
    // Les bonnes réponses ne sont révélées qu'en cas de réussite (sinon : seulement juste / faux)
    correction: Object.fromEntries(Object.entries(correction).map(([k, v]) => [k, reussi ? v : { correcte: v.correcte }])),
  })
}
