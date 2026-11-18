// « La Passerelle » : propositions des employés (idées d'articles, photos).
//  - Tout employé du WSSC peut proposer une idée, avec des fichiers PDF, JPEG ou PNG (espace privé).
//  - L'équipe de La Passerelle (employés choisis par l'administrateur global, quel que soit leur rôle)
//    voit les propositions reçues et reçoit un courriel à chaque nouvelle proposition.
import type { SupabaseClient } from '@supabase/supabase-js'
import { PREFIXE_MEDIA } from '@/lib/medias'
import { peutGererPasserelle, chargerEquipe, CLINIQUE_PASSERELLE } from '@/lib/passerelle'
import { cliniquesDe } from '@/lib/cliniques'

export const DOSSIER_PROPOSITIONS = 'passerelle-propositions'
export const FICHIERS_PROPOSITION = {
  types: { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' } as Record<string, string>,
  tailleMaxMo: 20,
  max: 10,
  libelle: 'PDF, JPEG ou PNG — 20 Mo max par fichier, 10 fichiers max',
}

export type FichierProposition = { ref: string; nom: string; type: string; taille: number }
export type StatutProposition = 'nouvelle' | 'retenue' | 'classee'
export const STATUTS_PROPOSITION: Record<StatutProposition, { libelle: string; bg: string; color: string }> = {
  nouvelle: { libelle: 'Nouvelle', bg: '#EEEDFE', color: '#3C3489' },
  retenue: { libelle: 'Retenue', bg: '#E1F5EE', color: '#085041' },
  classee: { libelle: 'Classée', bg: '#F3F4F6', color: '#4B5563' },
}
export const estStatut = (s: unknown): s is StatutProposition => typeof s === 'string' && s in STATUTS_PROPOSITION

export type Proposition = {
  id: string; employe_id: string | null; sujet: string; message: string; fichiers: FichierProposition[]
  statut: StatutProposition; note: string; cree_le: string; traite_le: string | null
}

const texte = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)

/** Chemin de dépôt d'un fichier : propre à l'employé, pour qu'il ne puisse joindre que ses propres fichiers. */
export const prefixeEmploye = (employeId: string) => `${DOSSIER_PROPOSITIONS}/${employeId}/`

/** Vérifie le type et la taille d'un fichier avant d'autoriser son envoi. */
export function fichierAccepte(type: unknown, taille: unknown): string | null {
  if (typeof type !== 'string' || !FICHIERS_PROPOSITION.types[type]) return `Format non accepté (${FICHIERS_PROPOSITION.libelle})`
  if (typeof taille !== 'number' || taille <= 0 || taille > FICHIERS_PROPOSITION.tailleMaxMo * 1024 * 1024) return `Fichier trop volumineux (${FICHIERS_PROPOSITION.libelle})`
  return null
}

/** Lit une proposition envoyée par un employé. */
export function lireProposition(c: Record<string, unknown>, employeId: string): { valeurs: Pick<Proposition, 'sujet' | 'message' | 'fichiers'> } | { erreur: string } {
  const sujet = texte(c.sujet, 200)
  const message = texte(c.message, 5000)
  const prefixe = PREFIXE_MEDIA + prefixeEmploye(employeId)
  const bruts = Array.isArray(c.fichiers) ? c.fichiers : []
  if (bruts.length > FICHIERS_PROPOSITION.max) return { erreur: `${FICHIERS_PROPOSITION.max} fichiers maximum.` }
  const fichiers: FichierProposition[] = []
  for (const f of bruts as Record<string, unknown>[]) {
    const ref = texte(f?.ref, 500)
    if (!ref.startsWith(prefixe) || ref.includes('..')) return { erreur: 'Fichier joint invalide.' }
    const type = texte(f?.type, 100)
    if (!FICHIERS_PROPOSITION.types[type]) return { erreur: `Format non accepté (${FICHIERS_PROPOSITION.libelle})` }
    fichiers.push({ ref, nom: texte(f?.nom, 200) || 'fichier', type, taille: Number(f?.taille) || 0 })
  }
  if (!sujet && !message && fichiers.length === 0) return { erreur: 'Décrivez votre idée ou joignez au moins un fichier.' }
  if (!sujet) return { erreur: 'Donnez un titre à votre proposition.' }
  return { valeurs: { sujet, message, fichiers } }
}

/** Équipe de La Passerelle : reçoit les propositions (et un courriel à chaque nouvelle). */
export const chargerDestinataires = chargerEquipe

/** Voit les propositions reçues : l'équipe de La Passerelle et l'administrateur global. */
export const peutVoirPropositions = peutGererPasserelle

/** Peut proposer : les employés du WSSC (et l'administrateur global). */
export function peutProposer(a: { role: string; clinique: string | null; externe?: boolean | null } | null): boolean {
  if (!a || a.externe === true) return false
  return a.role === 'super_admin' || cliniquesDe(a.clinique).includes(CLINIQUE_PASSERELLE)
}
