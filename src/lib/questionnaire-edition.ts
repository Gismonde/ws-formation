// Édition du questionnaire d'une formation après sa création (questions, réponses, seuil, tentatives).
import type { SupabaseClient } from '@supabase/supabase-js'

export type ReponseEdition = { texte: string; est_correcte: boolean }
export type QuestionEdition = { texte: string; points: number; reponses: ReponseEdition[] }
export type QuestionnaireEdition = {
  titre: string
  note_passage: number
  nb_tentatives_max: number | null
  questions: QuestionEdition[]
}

const texte = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** Valide le questionnaire envoyé par l'éditeur. Chaque question : un texte, 2 réponses ou plus, une seule bonne réponse. */
export function validerQuestionnaire(b: unknown): { erreur: string } | { valeurs: QuestionnaireEdition } {
  const c = (b ?? {}) as Record<string, unknown>
  const note = Number(c.note_passage)
  if (!Number.isInteger(note) || note < 1 || note > 100) return { erreur: 'Le seuil de réussite doit être entre 1 et 100 %.' }
  const tentatives = c.nb_tentatives_max === null || c.nb_tentatives_max === '' || c.nb_tentatives_max === undefined ? null : Number(c.nb_tentatives_max)
  if (tentatives !== null && (!Number.isInteger(tentatives) || tentatives < 1 || tentatives > 50)) return { erreur: 'Le nombre de tentatives doit être entre 1 et 50 (ou illimité).' }
  const brutes = Array.isArray(c.questions) ? c.questions : []
  if (brutes.length > 200) return { erreur: '200 questions au maximum.' }
  const questions: QuestionEdition[] = []
  for (let i = 0; i < brutes.length; i++) {
    const q = brutes[i] as Record<string, unknown>
    const t = texte(q.texte, 2000)
    if (!t) return { erreur: `Question ${i + 1} : le texte est obligatoire.` }
    const reponses = (Array.isArray(q.reponses) ? q.reponses : [])
      .map(r => r as Record<string, unknown>)
      .map(r => ({ texte: texte(r.texte, 1000), est_correcte: r.est_correcte === true }))
      .filter(r => r.texte)
    if (reponses.length < 2) return { erreur: `Question ${i + 1} : au moins deux réponses sont nécessaires.` }
    if (reponses.filter(r => r.est_correcte).length !== 1) return { erreur: `Question ${i + 1} : cochez une (et une seule) bonne réponse.` }
    const points = Number(q.points)
    questions.push({ texte: t, points: Number.isInteger(points) && points > 0 && points <= 100 ? points : 1, reponses })
  }
  return { valeurs: { titre: texte(c.titre, 200) || 'Questionnaire', note_passage: note, nb_tentatives_max: tentatives, questions } }
}

/** Questionnaire actif d'une formation, avec ses questions et réponses (bonnes réponses comprises : réservé aux créateurs). */
export async function lireQuestionnaire(sb: SupabaseClient, formationId: string) {
  const { data: q } = await sb.from('questionnaires').select('id, titre, note_passage, nb_tentatives_max').eq('formation_id', formationId).eq('actif', true).maybeSingle()
  if (!q) return null
  const { data: questions } = await sb.from('questions').select('id, texte, points, ordre, reponses_possibles(id, texte, est_correcte, ordre)').eq('questionnaire_id', q.id).order('ordre')
  return {
    ...q,
    questions: (questions ?? []).map(x => ({
      texte: x.texte as string,
      points: (x.points as number | null) ?? 1,
      reponses: ((x.reponses_possibles ?? []) as { texte: string; est_correcte: boolean; ordre: number }[])
        .sort((a, b) => a.ordre - b.ordre).map(r => ({ texte: r.texte, est_correcte: r.est_correcte })),
    })),
  }
}

/**
 * Enregistre le questionnaire : met à jour (ou crée) le questionnaire actif et remplace ses questions.
 * Aucune question → le questionnaire est désactivé (la formation se termine sans questionnaire).
 * Les tentatives passées restent rattachées au questionnaire.
 */
export async function enregistrerQuestionnaire(sb: SupabaseClient, formationId: string, v: QuestionnaireEdition): Promise<{ questionnaire_id: string | null }> {
  const { data: existant } = await sb.from('questionnaires').select('id').eq('formation_id', formationId).eq('actif', true).maybeSingle()
  if (v.questions.length === 0) {
    if (existant) await sb.from('questionnaires').update({ actif: false, updated_at: new Date().toISOString() }).eq('id', existant.id)
    return { questionnaire_id: null }
  }
  let id = existant?.id as string | undefined
  const champs = { titre: v.titre, note_passage: v.note_passage, nb_tentatives_max: v.nb_tentatives_max, updated_at: new Date().toISOString() }
  if (id) {
    const { error } = await sb.from('questionnaires').update(champs).eq('id', id)
    if (error) throw new Error(error.message)
    const { error: e2 } = await sb.from('questions').delete().eq('questionnaire_id', id)
    if (e2) throw new Error(e2.message)
  } else {
    const { data, error } = await sb.from('questionnaires').insert({ ...champs, formation_id: formationId, actif: true }).select('id').single()
    if (error) throw new Error(error.message)
    id = data.id as string
  }
  for (let i = 0; i < v.questions.length; i++) {
    const q = v.questions[i]
    const { data: question, error } = await sb.from('questions').insert({ questionnaire_id: id, texte: q.texte, type: 'choix_multiple', points: q.points, ordre: i + 1 }).select('id').single()
    if (error) throw new Error(error.message)
    const { error: e3 } = await sb.from('reponses_possibles').insert(q.reponses.map((r, j) => ({ question_id: question.id, texte: r.texte, est_correcte: r.est_correcte, ordre: j + 1 })))
    if (e3) throw new Error(e3.message)
  }
  return { questionnaire_id: id! }
}
