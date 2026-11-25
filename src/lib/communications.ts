// « Affiches & communications », « Nos guides », « Nos consentements » : documents déposés par les administrateurs (PDF ou image),
// par clinique, consultées par les employés (section Politiques & procédures). Pas de confirmation de lecture.
// À la publication, l'administrateur peut prévenir les employés de la clinique par courriel.
import type { SupabaseClient } from '@supabase/supabase-js'
import { adminConcerne, cliniquesDe } from '@/lib/cliniques'

export type Communication = {
  id: string; clinique: string; categorie: Categorie; titre: string; description: string; fichier: string; type_fichier: string
  apercu: string; publie: boolean; publie_le: string | null; cree_par: string | null; cree_le: string; modifie_le: string
}
export const CLINIQUES_COMMUNICATION = ['WSSC', 'CMC', 'LES_DEUX'] as const
/** Deux pages côté employé : affiches & communications, et nos guides. */
export type Categorie = 'communication' | 'guide' | 'consentement'
export const CATEGORIES: Record<Categorie, { libelle: string; page: string; emoji: string; un: string; intro: string; vide: string; nouveau: string; telechargeable: boolean }> = {
  communication: { libelle: 'Affiches & communications', page: '/dashboard/communications', emoji: '📢', un: 'Affiche / communication', intro: 'Les affiches et communications de la clinique. Cliquez pour les ouvrir.', vide: 'Aucune affiche ou communication pour le moment.', nouveau: 'Nouvelle affiche / communication', telechargeable: false },
  guide: { libelle: 'Nos guides', page: '/dashboard/guides', emoji: '📘', un: 'Guide', intro: 'Les guides de la clinique. Cliquez pour les ouvrir.', vide: 'Aucun guide pour le moment.', nouveau: 'Nouveau guide', telechargeable: false },
  consentement: { libelle: 'Nos consentements', page: '/dashboard/consentements', emoji: '✍️', un: 'Consentement', intro: 'Les formulaires de consentement de la clinique, à télécharger au besoin.', vide: 'Aucun consentement pour le moment.', nouveau: 'Nouveau consentement', telechargeable: true },
}
export const categorieDe = (c: unknown): Categorie => (typeof c === 'string' && c in CATEGORIES ? c as Categorie : 'communication')
export const TYPES_COMMUNICATION: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

/** Gérer une communication : administrateur de la clinique concernée, ou administrateur global. */
export function peutGererCommunication(a: { role: string; clinique: string | null } | null, clinique: string | null): boolean {
  return !!a && adminConcerne(a, clinique)
}
export const estAdminCommunications = (a: { role: string } | null) => !!a && (a.role === 'super_admin' || a.role === 'admin')

const texte = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)

/** Lit le formulaire d'une communication. (Fonction pure, testée.) */
export function lireCommunication(c: Record<string, unknown>): { valeurs: Pick<Communication, 'categorie' | 'clinique' | 'titre' | 'description' | 'fichier' | 'type_fichier' | 'apercu'> } | { erreur: string } {
  const titre = texte(c.titre, 200)
  if (!titre) return { erreur: 'Donnez un titre.' }
  const clinique = texte(c.clinique, 10)
  if (!(CLINIQUES_COMMUNICATION as readonly string[]).includes(clinique)) return { erreur: 'Clinique inconnue.' }
  const fichier = texte(c.fichier, 500)
  const refPermise = (r: string) => r.startsWith('media:communications/') && !r.includes('..')
  if (!refPermise(fichier)) return { erreur: 'Déposez le fichier de l’affiche ou de la communication (PDF ou image).' }
  const type_fichier = texte(c.type_fichier, 60)
  if (!TYPES_COMMUNICATION[type_fichier]) return { erreur: 'Format non accepté (PDF, JPEG, PNG ou WebP).' }
  const apercu = texte(c.apercu, 500)
  return { valeurs: { categorie: categorieDe(c.categorie), clinique, titre, description: texte(c.description, 2000), fichier, type_fichier, apercu: refPermise(apercu) ? apercu : '' } }
}

/** Une communication est visible par un employé de cette clinique. */
export function visiblePour(c: { clinique: string; publie: boolean }, cliniquesEspace: string[]): boolean {
  return c.publie && (c.clinique === 'LES_DEUX' || cliniquesEspace.includes(c.clinique))
}

/** Employés à prévenir d'une nouvelle communication : actifs, non externes, de la clinique. */
export async function destinatairesCommunication(sb: SupabaseClient, clinique: string) {
  const { data } = await sb.from('employes').select('id, prenom, email, clinique, actif, externe').eq('actif', true)
  const cibles = cliniquesDe(clinique === 'LES_DEUX' ? 'LES_DEUX' : clinique)
  return (data ?? []).filter(e => e.email && e.externe !== true && cliniquesDe((e.clinique as string | null) ?? null).some(c => cibles.includes(c)))
}
