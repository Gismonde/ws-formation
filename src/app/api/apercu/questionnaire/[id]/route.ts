// Mode employé : correction du questionnaire final sans rien enregistrer (pas de tentative, pas de certificat).
import { NextResponse } from 'next/server'
import { serviceClient } from '@/lib/permissions'
import { modeApercu } from '@/lib/apercu-employe'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = serviceClient()
  const { data: f } = await sb.from('formations').select('*').eq('id', id).maybeSingle()
  if (!f || !(await modeApercu(f)).actif) return NextResponse.json({ error: 'Mode employé inactif' }, { status: 403 })
  const { data: q } = await sb.from('questionnaires').select('id, note_passage').eq('formation_id', id).eq('actif', true).order('created_at').limit(1).maybeSingle()
  if (!q) return NextResponse.json({ error: 'Aucun questionnaire' }, { status: 404 })
  const { reponses = {} } = await req.json().catch(() => ({})) as { reponses?: Record<string, string> }
  const { data: questions } = await sb.from('questions').select('id, points, reponses_possibles(id, est_correcte)').eq('questionnaire_id', q.id)
  let obtenue = 0, maximale = 0
  const correction: Record<string, { correcte: boolean; bonne_reponse?: string }> = {}
  for (const question of questions ?? []) {
    const points = question.points && question.points > 0 ? question.points : 1
    const choix = (question.reponses_possibles ?? []).find(r => r.id === reponses[question.id])
    const bonne = (question.reponses_possibles ?? []).find(r => r.est_correcte)
    const correcte = !!choix && choix.est_correcte === true
    maximale += points
    if (correcte) obtenue += points
    correction[question.id] = { correcte, bonne_reponse: bonne?.id }
  }
  const score = maximale ? Math.round((obtenue / maximale) * 100) : 0
  return NextResponse.json({
    score, reussi: score >= q.note_passage, seuil: q.note_passage, certificatId: null,
    sansCertificat: f.delivre_certificat === false, tentativesRestantes: null, correction, apercu: true,
  })
}
