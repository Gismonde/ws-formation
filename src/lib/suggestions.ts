// « Aidez-nous à nous améliorer » : suggestions des employés et leur traitement par l'administration.
import { createHash } from 'crypto'
import type { Acteur } from '@/lib/permissions'
import { cliniquesDe } from '@/lib/cliniques'

export const TYPES_SUGGESTION = [
  { id: 'formation', icone: '🎓', libelle: 'Demande de formation', aide: 'Un sujet sur lequel vous aimeriez être formé(e)' },
  { id: 'commentaire', icone: '💬', libelle: 'Commentaire sur une formation', aide: 'Ce qui vous a aidé, ce qui pourrait être plus clair' },
  { id: 'plateforme', icone: '🛠️', libelle: 'Idée pour la plateforme', aide: 'Une amélioration pour WS Formation' },
] as const
export type TypeSuggestion = (typeof TYPES_SUGGESTION)[number]['id']

export const STATUTS_SUGGESTION = [
  { id: 'nouvelle', libelle: 'Nouvelle', couleur: 'bg-indigo-50 text-indigo-700' },
  { id: 'en_etude', libelle: 'En étude', couleur: 'bg-amber-50 text-amber-700' },
  { id: 'planifiee', libelle: 'Planifiée', couleur: 'bg-sky-50 text-sky-700' },
  { id: 'realisee', libelle: 'Réalisée', couleur: 'bg-green-50 text-green-700' },
  { id: 'refusee', libelle: 'Non retenue', couleur: 'bg-gray-100 text-gray-600' },
] as const
export type StatutSuggestion = (typeof STATUTS_SUGGESTION)[number]['id']

export const MAX_PAR_SEMAINE = 3
export const LONGUEUR_MAX = 1000

export type Suggestion = {
  id: string; type: TypeSuggestion; formation_id: string | null; sujet: string | null; message: string
  employe_id: string | null; anonyme: boolean; clinique: string | null; statut: StatutSuggestion
  reponse: string | null; repondu_le: string | null; created_at: string
}

/** Empreinte non réversible de l'auteur (sel secret côté serveur) */
export function empreinteAuteur(employeId: string): string {
  return createHash('sha256').update(`${employeId}:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'ws'}`).digest('hex')
}

/** Valide le formulaire (fonction pure, testée) */
export function lireSuggestion(b: Record<string, unknown>): { erreur: string } | { valeurs: { type: TypeSuggestion; formation_id: string | null; sujet: string | null; message: string; anonyme: boolean } } {
  const type = TYPES_SUGGESTION.some(x => x.id === b.type) ? (b.type as TypeSuggestion) : null
  if (!type) return { erreur: 'Choisissez le type de suggestion.' }
  const message = typeof b.message === 'string' ? b.message.trim().slice(0, LONGUEUR_MAX) : ''
  if (message.length < 5) return { erreur: 'Écrivez votre suggestion (quelques mots au moins).' }
  const sujet = typeof b.sujet === 'string' ? b.sujet.trim().slice(0, 150) || null : null
  if (type === 'formation' && !sujet) return { erreur: 'Indiquez le sujet de la formation souhaitée.' }
  const formation_id = type === 'commentaire' && typeof b.formation_id === 'string' && /^[0-9a-f-]{36}$/i.test(b.formation_id) ? b.formation_id : null
  if (type === 'commentaire' && !formation_id) return { erreur: 'Choisissez la formation concernée.' }
  return { valeurs: { type, formation_id, sujet: type === 'commentaire' ? null : sujet, message, anonyme: b.anonyme === true } }
}

/** Qui peut voir / traiter une suggestion : idées plateforme → administrateur global ; le reste → administrateurs de la clinique */
export function peutTraiterSuggestion(a: Pick<Acteur, 'role' | 'clinique'>, s: Pick<Suggestion, 'type' | 'clinique'>): boolean {
  if (a.role === 'super_admin') return true
  if (a.role !== 'admin' || s.type === 'plateforme') return false
  const miennes = cliniquesDe(a.clinique)
  const siennes = cliniquesDe(s.clinique ?? 'LES_DEUX')
  return siennes.some(c => miennes.includes(c))
}
