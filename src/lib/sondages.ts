// Sondages de satisfaction (distincts des examens) : questions, validation, état et résultats.
// Table sondage_reponses (supabase/migrations/conformite_suivi.sql) ; sans elle, la fonction est inactive.
import type { SupabaseClient } from '@supabase/supabase-js'
import { chargerEtatsFormations, estComplete } from '@/lib/etat-formations'

export const QUESTIONS_SONDAGE = [
  { cle: 'note_globale', texte: 'Dans l’ensemble, êtes-vous satisfait(e) de cette formation ?' },
  { cle: 'clarte', texte: 'Le contenu était clair et facile à suivre.' },
  { cle: 'utilite', texte: 'Ce que j’ai appris est utile dans mon travail.' },
  { cle: 'duree', texte: 'La durée de la formation était adaptée.' },
  { cle: 'recommandation', texte: 'Je recommanderais cette formation à un(e) collègue.' },
] as const

export type CleQuestion = (typeof QUESTIONS_SONDAGE)[number]['cle']
export const ECHELLE = ['Pas du tout d’accord', 'Plutôt pas d’accord', 'Neutre', 'Plutôt d’accord', 'Tout à fait d’accord'] as const
export const COMMENTAIRE_MAX = 2000

export type ReponseSondage = Record<CleQuestion, number> & { commentaire: string | null }

/** Valide une réponse reçue du navigateur ; renvoie un message d'erreur ou la réponse nettoyée. */
export function validerReponse(brut: unknown): { erreur: string } | { reponse: ReponseSondage } {
  if (!brut || typeof brut !== 'object') return { erreur: 'Réponse invalide' }
  const b = brut as Record<string, unknown>
  const r = {} as ReponseSondage
  for (const q of QUESTIONS_SONDAGE) {
    const v = Number(b[q.cle])
    if (!Number.isInteger(v) || v < 1 || v > 5) return { erreur: 'Répondez à toutes les questions (de 1 à 5).' }
    r[q.cle] = v
  }
  const c = typeof b.commentaire === 'string' ? b.commentaire.trim() : ''
  if (c.length > COMMENTAIRE_MAX) return { erreur: `Commentaire trop long (${COMMENTAIRE_MAX} caractères maximum).` }
  r.commentaire = c || null
  return { reponse: r }
}

export async function sondagesDisponibles(sb: SupabaseClient): Promise<boolean> {
  const { error } = await sb.from('sondage_reponses').select('id', { head: true, count: 'exact' }).limit(1)
  return !error
}

export type EtatSondage = 'inactif' | 'pas_encore' | 'a_repondre' | 'repondu'

/** Le sondage est proposé à l'employé une fois la formation terminée ou certifiée, une seule fois. */
export async function etatSondage(sb: SupabaseClient, employeId: string, formationId: string): Promise<EtatSondage> {
  if (!(await sondagesDisponibles(sb))) return 'inactif'
  const { data: f } = await sb.from('formations').select('*').eq('id', formationId).maybeSingle()
  if (!f || f.sondage_actif === false) return 'inactif'
  const { data: deja } = await sb.from('sondage_reponses').select('id').eq('formation_id', formationId).eq('employe_id', employeId).maybeSingle()
  if (deja) return 'repondu'
  const etat = await chargerEtatsFormations(sb, [employeId], [formationId])
  return estComplete(etat(employeId, formationId).statut) ? 'a_repondre' : 'pas_encore'
}

// ---------------------------------------------------------------------------
// Résultats (sans nom)

export type ResultatsSondage = {
  formation_id: string
  reponses: number
  moyennes: Record<CleQuestion, number | null>
  repartition: Record<CleQuestion, number[]>
  /** Satisfaction globale : % de réponses 4 ou 5 */
  satisfaits: number | null
  commentaires: { texte: string; date: string }[]
}

export function agregerReponses(formationId: string, lignes: (ReponseSondage & { created_at: string })[]): ResultatsSondage {
  const moyennes = {} as Record<CleQuestion, number | null>
  const repartition = {} as Record<CleQuestion, number[]>
  for (const q of QUESTIONS_SONDAGE) {
    const valeurs = lignes.map(l => l[q.cle]).filter(v => v >= 1 && v <= 5)
    moyennes[q.cle] = valeurs.length ? Math.round((valeurs.reduce((a, b) => a + b, 0) / valeurs.length) * 10) / 10 : null
    repartition[q.cle] = [1, 2, 3, 4, 5].map(n => valeurs.filter(v => v === n).length)
  }
  return {
    formation_id: formationId,
    reponses: lignes.length,
    moyennes,
    repartition,
    satisfaits: lignes.length ? Math.round((lignes.filter(l => l.note_globale >= 4).length / lignes.length) * 100) : null,
    commentaires: lignes.filter(l => l.commentaire).map(l => ({ texte: l.commentaire!, date: l.created_at }))
      .sort((a, b) => (a.date < b.date ? 1 : -1)),
  }
}

/** Réponses des employés de la portée (ids) pour ces formations. */
export async function chargerReponses(sb: SupabaseClient, formationIds: string[], employeIds: string[] | null) {
  if (formationIds.length === 0) return []
  let q = sb.from('sondage_reponses')
    .select('formation_id, employe_id, note_globale, clarte, utilite, duree, recommandation, commentaire, created_at')
    .in('formation_id', formationIds)
  if (employeIds) {
    if (employeIds.length === 0) return []
    q = q.in('employe_id', employeIds)
  }
  const { data } = await q
  return (data ?? []) as (ReponseSondage & { formation_id: string; employe_id: string; created_at: string })[]
}
