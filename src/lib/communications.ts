// « Affiches & communications », « Nos guides », « Nos consentements » : documents déposés par les administrateurs (PDF ou image),
// par clinique, consultées par les employés (section Politiques & procédures). Pas de confirmation de lecture.
// À la publication, l'administrateur peut prévenir les employés de la clinique par courriel.
import type { SupabaseClient } from '@supabase/supabase-js'
import { adminConcerne, cliniquesDe } from '@/lib/cliniques'

export type Communication = {
  id: string; clinique: string; categorie: Categorie; titre: string; description: string; fichier: string; type_fichier: string
  theme_id: string | null; public: Public
  /** Vide : toute la clinique. Sinon : seulement ces départements (plus les administrateurs). */
  departements: string[]
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
/** Public d'un guide : employés ou patients. */
export type Public = 'employes' | 'patients'
export const PUBLICS: Record<Public, string> = { employes: 'Pour les employés', patients: 'Pour les patients' }
export const publicDe = (p: unknown): Public => (p === 'patients' ? 'patients' : 'employes')
/** Catégories générales (Recherche, Nutrition…) des guides et consentements, créées par les administrateurs. */
export type Theme = { id: string; nom: string }
export const avecThemes = (c: Categorie) => c !== 'communication'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function lireNomTheme(v: unknown): { nom: string } | { erreur: string } {
  const nom = String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 80)
  return nom ? { nom } : { erreur: 'Donnez un nom à la catégorie.' }
}
/** Regroupe par catégorie (ordre alphabétique, « sans catégorie » à la fin). (Fonction pure, testée.) */
export function grouperParTheme<T extends { theme_id: string | null }>(liste: T[], themes: Theme[]): { theme: Theme | null; elements: T[] }[] {
  const tries = [...themes].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  const groupes: { theme: Theme | null; elements: T[] }[] = tries.map(theme => ({ theme, elements: liste.filter(c => c.theme_id === theme.id) }))
  const connus = new Set(themes.map(t => t.id))
  groupes.push({ theme: null, elements: liste.filter(c => !c.theme_id || !connus.has(c.theme_id)) })
  return groupes.filter(g => g.elements.length > 0)
}
export const TYPES_COMMUNICATION: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

/** Gérer une communication : administrateur de la clinique concernée, ou administrateur global. */
export function peutGererCommunication(a: { role: string; clinique: string | null } | null, clinique: string | null): boolean {
  return !!a && adminConcerne(a, clinique)
}
export const estAdminCommunications = (a: { role: string } | null) => !!a && (a.role === 'super_admin' || a.role === 'admin')

const texte = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)

/** Lit le formulaire d'une communication. (Fonction pure, testée.) */
export function lireCommunication(c: Record<string, unknown>): { valeurs: Pick<Communication, 'categorie' | 'theme_id' | 'public' | 'departements' | 'clinique' | 'titre' | 'description' | 'fichier' | 'type_fichier' | 'apercu'> } | { erreur: string } {
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
  const categorie = categorieDe(c.categorie)
  const theme = texte(c.theme_id, 40)
  const departements = Array.isArray(c.departements) ? [...new Set((c.departements as unknown[]).map(d => texte(d, 40)).filter(d => UUID.test(d)))].slice(0, 50) : []
  return { valeurs: { categorie, departements, theme_id: avecThemes(categorie) && UUID.test(theme) ? theme : null, public: categorie === 'guide' ? publicDe(c.public) : 'employes', clinique, titre, description: texte(c.description, 2000), fichier, type_fichier, apercu: refPermise(apercu) ? apercu : '' } }
}

/** Une communication est visible par un employé de cette clinique (et de l'un des départements, si elle leur est réservée). */
export function visiblePour(c: { clinique: string; publie: boolean; departements?: string[] | null }, cliniquesEspace: string[], a?: { role: string; departement_id: string | null } | null): boolean {
  return c.publie && (c.clinique === 'LES_DEUX' || cliniquesEspace.includes(c.clinique)) && departementPermis(c, a ?? null)
}
/** Document réservé à certains départements : seuls ces départements, les administrateurs et l'administrateur global. */
export function departementPermis(c: { departements?: string[] | null }, a: { role: string; departement_id: string | null } | null): boolean {
  const d = c.departements ?? []
  if (d.length === 0) return true
  if (!a) return false
  return a.role === 'admin' || a.role === 'super_admin' || (!!a.departement_id && d.includes(a.departement_id))
}

/** Employés à prévenir d'une nouvelle communication : actifs, non externes, de la clinique. */
export async function destinatairesCommunication(sb: SupabaseClient, clinique: string, departements: string[] = []) {
  const { data } = await sb.from('employes').select('id, prenom, email, clinique, actif, externe, role, departement_id').eq('actif', true)
  const cibles = cliniquesDe(clinique === 'LES_DEUX' ? 'LES_DEUX' : clinique)
  return (data ?? []).filter(e => e.email && e.externe !== true && cliniquesDe((e.clinique as string | null) ?? null).some(c => cibles.includes(c))
    && departementPermis({ departements }, { role: e.role as string, departement_id: (e.departement_id as string | null) ?? null }))
}
