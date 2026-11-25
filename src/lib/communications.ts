// « Affiches & communications », « Nos guides », « Nos consentements » : documents déposés par les administrateurs (PDF ou image),
// par clinique, consultées par les employés (section Politiques & procédures). Pas de confirmation de lecture.
// À la publication, l'administrateur peut prévenir les employés de la clinique par courriel.
import type { SupabaseClient } from '@supabase/supabase-js'
import { adminConcerne, cliniquesDe } from '@/lib/cliniques'

export type Communication = {
  id: string; clinique: string; categorie: Categorie; titre: string; description: string; fichier: string; type_fichier: string
  theme_id: string | null; public: Public
  /** Catégories du document (plusieurs possibles, à n'importe quel niveau : Chirurgie › Chirurgie générale › Dre Doyon). */
  themes: string[]
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
export type Theme = { id: string; nom: string; parent_id: string | null }
export const avecThemes = (c: Categorie) => c !== 'communication'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function lireNomTheme(v: unknown): { nom: string } | { erreur: string } {
  const nom = String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 80)
  return nom ? { nom } : { erreur: 'Donnez un nom à la catégorie.' }
}
export const estUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v)
const parNom = (a: Theme, b: Theme) => a.nom.localeCompare(b.nom, 'fr')

/** Catégories d'un document (nouvelle colonne themes, ou ancienne theme_id). */
export const themesDe = (c: { themes?: string[] | null; theme_id?: string | null }) => (c.themes?.length ? c.themes : c.theme_id ? [c.theme_id] : [])

/** Chemin d'une catégorie : « Chirurgie › Chirurgie générale › Dre Doyon ». */
export function cheminTheme(id: string, themes: Theme[]): Theme[] {
  const parId = new Map(themes.map(t => [t.id, t]))
  const chemin: Theme[] = []
  for (let t = parId.get(id); t && chemin.length < 10; t = t.parent_id ? parId.get(t.parent_id) : undefined) chemin.unshift(t)
  return chemin
}

/** Les catégories en liste à plat, dans l'ordre de l'arbre, avec leur niveau (0, 1, 2…). (Fonction pure, testée.) */
export function themesEnArbre(themes: Theme[]): (Theme & { niveau: number })[] {
  const connus = new Set(themes.map(t => t.id))
  const enfants = (p: string | null) => themes.filter(t => (t.parent_id && connus.has(t.parent_id) ? t.parent_id : null) === p).sort(parNom)
  const out: (Theme & { niveau: number })[] = []
  const vus = new Set<string>()
  const visiter = (p: string | null, niveau: number) => { for (const t of enfants(p)) { if (vus.has(t.id)) continue; vus.add(t.id); out.push({ ...t, niveau }); visiter(t.id, niveau + 1) } }
  visiter(null, 0)
  return out
}

export type Groupe<T> = { theme: Theme | null; elements: T[]; sous: Groupe<T>[]; total: number }
/** Range les documents dans l'arbre des catégories (un document peut être à plusieurs endroits) ; « sans catégorie » à la fin. (Fonction pure, testée.) */
export function grouperParTheme<T extends { id?: string; themes?: string[] | null; theme_id?: string | null }>(liste: T[], themes: Theme[]): Groupe<T>[] {
  const connus = new Set(themes.map(t => t.id))
  const construire = (p: string | null): Groupe<T>[] => themes
    .filter(t => (t.parent_id && connus.has(t.parent_id) ? t.parent_id : null) === p).sort(parNom)
    .map(theme => {
      const sous = construire(theme.id)
      const elements = liste.filter(c => themesDe(c).includes(theme.id))
      const ids = new Set<unknown>([...elements, ...sous.flatMap(function tous(g: Groupe<T>): T[] { return [...g.elements, ...g.sous.flatMap(tous)] })].map(e => e.id ?? e))
      return { theme, elements, sous, total: ids.size }
    })
    .filter(g => g.total > 0)
  const groupes = construire(null)
  const sans = liste.filter(c => !themesDe(c).some(id => connus.has(id)))
  if (sans.length) groupes.push({ theme: null, elements: sans, sous: [], total: sans.length })
  return groupes
}
export const TYPES_COMMUNICATION: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

/** Gérer une communication : administrateur de la clinique concernée, ou administrateur global. */
export function peutGererCommunication(a: { role: string; clinique: string | null } | null, clinique: string | null): boolean {
  return !!a && adminConcerne(a, clinique)
}
export const estAdminCommunications = (a: { role: string } | null) => !!a && (a.role === 'super_admin' || a.role === 'admin')

const texte = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)

/** Lit le formulaire d'une communication. (Fonction pure, testée.) */
export function lireCommunication(c: Record<string, unknown>): { valeurs: Pick<Communication, 'categorie' | 'theme_id' | 'themes' | 'public' | 'departements' | 'clinique' | 'titre' | 'description' | 'fichier' | 'type_fichier' | 'apercu'> } | { erreur: string } {
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
  const brutes = Array.isArray(c.themes) ? c.themes : c.theme_id ? [c.theme_id] : []
  const themes = avecThemes(categorie) ? [...new Set((brutes as unknown[]).map(v => texte(v, 40)).filter(estUuid))].slice(0, 20) : []
  const departements = Array.isArray(c.departements) ? [...new Set((c.departements as unknown[]).map(d => texte(d, 40)).filter(d => UUID.test(d)))].slice(0, 50) : []
  return { valeurs: { categorie, departements, themes, theme_id: themes[0] ?? null, public: categorie === 'guide' ? publicDe(c.public) : 'employes', clinique, titre, description: texte(c.description, 2000), fichier, type_fichier, apercu: refPermise(apercu) ? apercu : '' } }
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

// ——— Explorateur (arbre + recherche + filtres) des guides et consentements ———
/** Texte sans accents ni majuscules, pour la recherche. */
export const normaliser = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
/** Langue d'un document : anglais si le titre se termine par (EN) ou si la description l'indique. */
export const langueDe = (c: { titre: string; description?: string | null }): 'fr' | 'en' =>
  /\(EN\)/.test(c.titre) || /(^|·)\s*English\s*$/.test(c.description ?? '') ? 'en' : 'fr'
/** Une catégorie et toutes ses sous-catégories. */
export function descendants(id: string, themes: Theme[]): Set<string> {
  const out = new Set([id])
  for (let ajout = true; ajout;) { ajout = false; for (const t of themes) if (t.parent_id && out.has(t.parent_id) && !out.has(t.id)) { out.add(t.id); ajout = true } }
  return out
}
export type FiltreDocs = { theme: string | null | 'sans'; q: string; langue: '' | 'fr' | 'en' }
/** Documents qui correspondent au filtre (catégorie et sous-catégories, mots, langue). (Fonction pure, testée.) */
export function filtrerDocuments<T extends { titre: string; description?: string | null; themes?: string[] | null; theme_id?: string | null }>(liste: T[], themes: Theme[], f: FiltreDocs): T[] {
  const sousArbre = f.theme && f.theme !== 'sans' ? descendants(f.theme, themes) : null
  const connus = new Set(themes.map(t => t.id))
  const mots = normaliser(f.q).split(/\s+/).filter(Boolean)
  return liste.filter(c => {
    const ids = themesDe(c)
    if (f.theme === 'sans' && ids.some(id => connus.has(id))) return false
    if (sousArbre && !ids.some(id => sousArbre.has(id))) return false
    if (f.langue && langueDe(c) !== f.langue) return false
    if (mots.length) {
      const texte = normaliser([c.titre, c.description ?? '', ...ids.flatMap(id => cheminTheme(id, themes).map(t => t.nom))].join(' '))
      if (!mots.every(m => texte.includes(m))) return false
    }
    return true
  })
}
