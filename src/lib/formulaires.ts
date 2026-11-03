// Formulaires remplis par les employés (ex. déclaration d'incident).
// - Créés par l'administrateur global ou par un administrateur à qui il en a donné le droit.
// - Reçus par l'administrateur désigné comme destinataire, ou à défaut par le créateur.
// - Des sections peuvent être « réservées » : invisibles pour l'employé, complétées par la personne qui reçoit.
// (Utilisé aussi côté navigateur : aucun import de module serveur ici.)
import type { Acteur } from '@/lib/permissions'
import { cliniquesDe, type Clinique } from '@/lib/cliniques'

/** Cliniques administrées (même règle que permissions.cliniquesAdministrees, sans dépendance serveur). */
function cliniquesAdministrees(a: Acteur): Clinique[] {
  const base: Clinique[] = a.role === 'super_admin' ? ['CMC', 'WSSC'] : a.role === 'admin' ? cliniquesDe(a.clinique) : []
  return a.vue ? base.filter(c => c === a.vue) : base
}

export const TYPES_CHAMP = [
  { type: 'section', libelle: 'Section (titre)', icone: '🔖' },
  { type: 'info', libelle: 'Texte d’aide (non rempli)', icone: 'ℹ️' },
  { type: 'texte', libelle: 'Réponse courte', icone: '✏️' },
  { type: 'texte_long', libelle: 'Réponse longue', icone: '📝' },
  { type: 'date', libelle: 'Date', icone: '📅' },
  { type: 'heure', libelle: 'Heure', icone: '🕐' },
  { type: 'date_heure', libelle: 'Date et heure', icone: '🗓️' },
  { type: 'nombre', libelle: 'Nombre', icone: '#️⃣' },
  { type: 'courriel', libelle: 'Courriel', icone: '✉️' },
  { type: 'telephone', libelle: 'Téléphone', icone: '📞' },
  { type: 'choix_unique', libelle: 'Choix unique', icone: '🔘' },
  { type: 'choix_multiple', libelle: 'Cases à cocher', icone: '☑️' },
  { type: 'liste', libelle: 'Liste déroulante', icone: '🔽' },
  { type: 'case', libelle: 'Case unique (oui / confirmation)', icone: '✅' },
  { type: 'tableau', libelle: 'Tableau', icone: '▦' },
  { type: 'signature', libelle: 'Signature (nom + date)', icone: '🖊️' },
] as const

export type TypeChamp = (typeof TYPES_CHAMP)[number]['type']

export const PREREMPLIS = [
  { cle: 'nom', libelle: 'Nom de l’employé' },
  { cle: 'courriel', libelle: 'Courriel de l’employé' },
  { cle: 'poste', libelle: 'Poste / fonction' },
  { cle: 'departement', libelle: 'Département' },
  { cle: 'aujourdhui', libelle: 'Date du jour' },
  { cle: 'maintenant', libelle: 'Heure actuelle' },
] as const
export type Prerempli = (typeof PREREMPLIS)[number]['cle']

export type Champ = {
  id: string
  type: TypeChamp
  libelle: string
  /** Aide affichée sous la question */
  aide?: string
  obligatoire?: boolean
  /** Choix (choix_unique, choix_multiple, liste) */
  options?: string[]
  /** Ajoute « Autre : … » avec une zone de texte */
  autre?: boolean
  /** Tableau : colonnes, et lignes fixes (sinon l'employé ajoute des lignes) */
  colonnes?: string[]
  lignes?: string[]
  /** Section réservée à la personne qui reçoit (et tous les champs qui suivent jusqu'à la section suivante) */
  reserve?: boolean
  prerempli?: Prerempli
  /** Affichage sur une demi-largeur (deux champs côte à côte) */
  demi?: boolean
}

export type Formulaire = {
  id: string
  titre: string
  code: string | null
  description: string | null
  instructions: string | null
  clinique: 'CMC' | 'WSSC' | 'LES_DEUX'
  champs: Champ[]
  actif: boolean
  archive: boolean
  cree_par: string | null
  destinataire_id: string | null
  created_at?: string
  updated_at?: string
}

export type StatutReponse = 'recu' | 'en_traitement' | 'traite'
export const STATUTS: Record<StatutReponse, { libelle: string; couleur: string; fond: string }> = {
  recu: { libelle: 'Reçu', couleur: '#1d4ed8', fond: '#dbeafe' },
  en_traitement: { libelle: 'En traitement', couleur: '#92400e', fond: '#fef3c7' },
  traite: { libelle: 'Traité', couleur: '#166534', fond: '#dcfce7' },
}

export type Reponses = Record<string, unknown>

// ---------------------------------------------------------------------------
// Droits

/** Créer des formulaires : l'administrateur global, ou un administrateur qui en a reçu le droit. */
export function peutCreerFormulaires(a: Acteur | null | undefined): boolean {
  if (!a) return false
  if (a.role === 'super_admin') return true
  return a.role === 'admin' && a.peut_creer_formulaires === true && cliniquesAdministrees(a).length > 0
}

/** Cliniques possibles pour un formulaire créé par cette personne. */
export function cliniquesFormulairePossibles(a: Acteur): ('CMC' | 'WSSC' | 'LES_DEUX')[] {
  const cl = cliniquesAdministrees(a)
  return cl.length === 2 ? ['WSSC', 'CMC', 'LES_DEUX'] : cl
}

/** Modifier le formulaire : son créateur (s'il a toujours le droit) ou l'administrateur global. */
export function peutModifierFormulaire(a: Acteur, f: Pick<Formulaire, 'cree_par' | 'clinique'>): boolean {
  if (a.role === 'super_admin') return true
  return peutCreerFormulaires(a) && f.cree_par === a.id
}

/** Qui reçoit les réponses : le destinataire désigné, sinon le créateur. */
export function destinataireDe(f: Pick<Formulaire, 'cree_par' | 'destinataire_id'>): string | null {
  return f.destinataire_id || f.cree_par
}

/** Consulter les réponses : la personne qui les reçoit, le créateur, ou l'administrateur global. */
export function peutVoirReponses(a: Acteur, f: Pick<Formulaire, 'cree_par' | 'destinataire_id'>): boolean {
  if (a.role === 'super_admin') return true
  if (a.role !== 'admin') return false
  return destinataireDe(f) === a.id || f.cree_par === a.id
}

/** Le formulaire est-il proposé à cet employé (dans son espace) ? */
export function formulairePourEmploye(f: Pick<Formulaire, 'clinique' | 'actif' | 'archive'>, espace: Clinique | null, cliniqueEmploye: string | null): boolean {
  if (!f.actif || f.archive) return false
  const cl = cliniquesDe(f.clinique)
  if (espace) return cl.includes(espace)
  return cl.some(c => cliniquesDe(cliniqueEmploye).includes(c))
}

// ---------------------------------------------------------------------------
// Structure

/** Sections réservées : chaque champ hérite de la section qui le précède. */
export function champsAvecReserve(champs: Champ[]): (Champ & { estReserve: boolean })[] {
  let sectionReservee = false
  return champs.map(c => {
    if (c.type === 'section') sectionReservee = !!c.reserve
    return { ...c, estReserve: sectionReservee || !!c.reserve }
  })
}

export const estSaisissable = (c: Champ) => c.type !== 'section' && c.type !== 'info'

const MAX_TEXTE = 300
const MAX_LONG = 8000
const LIM = (s: unknown, n: number) => String(s ?? '').slice(0, n)
const nettoyerListe = (l: unknown, max = 60) => Array.isArray(l) ? l.map(x => LIM(x, 200).trim()).filter(Boolean).slice(0, max) : []
const TYPES = new Set<string>(TYPES_CHAMP.map(t => t.type))
const PRE = new Set<string>(PREREMPLIS.map(p => p.cle))

/** Valide et nettoie la définition envoyée par l'éditeur. */
export function nettoyerChamps(brut: unknown): { champs: Champ[] } | { erreur: string } {
  if (!Array.isArray(brut)) return { erreur: 'Liste de champs invalide' }
  if (brut.length > 300) return { erreur: 'Trop de champs (300 au maximum)' }
  const vus = new Set<string>()
  const champs: Champ[] = []
  for (const b of brut as Record<string, unknown>[]) {
    const type = String(b?.type ?? '')
    if (!TYPES.has(type)) return { erreur: `Type de champ inconnu : ${type}` }
    let id = LIM(b.id, 60).replace(/[^\w-]/g, '')
    if (!id || vus.has(id)) id = 'c' + Math.random().toString(36).slice(2, 10)
    vus.add(id)
    const libelle = LIM(b.libelle, 500).trim()
    if (!libelle && type !== 'info') return { erreur: 'Chaque champ doit avoir un libellé' }
    const c: Champ = { id, type: type as TypeChamp, libelle }
    const aide = LIM(b.aide, 2000).trim(); if (aide) c.aide = aide
    if (b.obligatoire === true && estSaisissable(c)) c.obligatoire = true
    if (b.reserve === true && (type === 'section' || estSaisissable(c))) c.reserve = true
    if (b.demi === true && estSaisissable(c)) c.demi = true
    if (['choix_unique', 'choix_multiple', 'liste'].includes(type)) {
      c.options = nettoyerListe(b.options, 80)
      if (!c.options.length) return { erreur: `« ${libelle} » : ajoutez au moins un choix` }
      if (b.autre === true) c.autre = true
    }
    if (type === 'tableau') {
      c.colonnes = nettoyerListe(b.colonnes, 8)
      if (!c.colonnes.length) return { erreur: `« ${libelle} » : ajoutez au moins une colonne` }
      const lignes = nettoyerListe(b.lignes, 30)
      if (lignes.length) c.lignes = lignes
    }
    if (typeof b.prerempli === 'string' && PRE.has(b.prerempli) && ['texte', 'courriel', 'date', 'heure'].includes(type)) c.prerempli = b.prerempli as Prerempli
    champs.push(c)
  }
  return { champs }
}

// ---------------------------------------------------------------------------
// Réponses

const vide = (v: unknown) => v == null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && v.length === 0) || v === false
const RE_DATE = /^\d{4}-\d{2}-\d{2}$/
const RE_HEURE = /^\d{2}:\d{2}$/
const RE_DATE_HEURE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
const RE_COURRIEL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const CLE_AUTRE = (id: string) => id + '__autre'

/**
 * Valide les réponses pour un ensemble de champs (ceux de l'employé, ou ceux réservés).
 * Renvoie les valeurs nettoyées (seulement les champs attendus) ou la première erreur.
 */
export function validerReponses(champs: Champ[], brut: unknown, partie: 'employe' | 'reserve'): { valeurs: Reponses } | { erreur: string } {
  const r = (brut && typeof brut === 'object' ? brut : {}) as Record<string, unknown>
  const valeurs: Reponses = {}
  for (const c of champsAvecReserve(champs)) {
    if (!estSaisissable(c) || c.estReserve !== (partie === 'reserve')) continue
    const v = r[c.id]
    const nom = c.libelle || 'Champ'
    let propre: unknown = null
    switch (c.type) {
      case 'texte': case 'telephone': propre = LIM(v, MAX_TEXTE).trim(); break
      case 'texte_long': propre = LIM(v, MAX_LONG).trim(); break
      case 'courriel': propre = LIM(v, 200).trim(); if (propre && !RE_COURRIEL.test(String(propre))) return { erreur: `« ${nom} » : courriel invalide` }; break
      case 'nombre': propre = LIM(v, 30).trim(); if (propre && !/^-?\d+([.,]\d+)?$/.test(String(propre))) return { erreur: `« ${nom} » : nombre invalide` }; break
      case 'date': propre = LIM(v, 10); if (propre && !RE_DATE.test(String(propre))) return { erreur: `« ${nom} » : date invalide` }; break
      case 'heure': propre = LIM(v, 5); if (propre && !RE_HEURE.test(String(propre))) return { erreur: `« ${nom} » : heure invalide` }; break
      case 'date_heure': propre = LIM(v, 16); if (propre && !RE_DATE_HEURE.test(String(propre))) return { erreur: `« ${nom} » : date et heure invalides` }; break
      case 'choix_unique': case 'liste': {
        const s = LIM(v, 200)
        if (s && !(c.options ?? []).includes(s) && !(c.autre && s === '__autre__')) return { erreur: `« ${nom} » : choix invalide` }
        propre = s
        break
      }
      case 'choix_multiple': {
        const l = Array.isArray(v) ? v.map(x => LIM(x, 200)) : []
        propre = l.filter(x => (c.options ?? []).includes(x) || (c.autre && x === '__autre__'))
        break
      }
      case 'case': propre = v === true; break
      case 'tableau': {
        const ncol = (c.colonnes ?? []).length
        const lignes = Array.isArray(v) ? v.slice(0, c.lignes?.length || 30) : []
        propre = lignes.map(l => Array.from({ length: ncol }, (_, k) => LIM(Array.isArray(l) ? l[k] : '', 500).trim()))
          .filter((l, i) => c.lignes?.length ? true : l.some(x => x)) // lignes libres vides retirées
          .slice(0, c.lignes?.length || 30)
        if (c.lignes?.length && (propre as string[][]).every(l => l.every(x => !x))) propre = []
        break
      }
      case 'signature': {
        const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
        const nomSig = LIM(o.nom, 200).trim()
        propre = nomSig ? { nom: nomSig, le: new Date().toISOString() } : null
        break
      }
    }
    if (c.obligatoire && vide(propre)) return { erreur: `« ${nom} » est obligatoire` }
    if (!vide(propre)) valeurs[c.id] = propre
    // « Autre : … »
    if (c.autre) {
      const choisi = c.type === 'choix_multiple' ? (propre as string[] ?? []).includes('__autre__') : propre === '__autre__'
      const txt = LIM(r[CLE_AUTRE(c.id)], MAX_TEXTE).trim()
      if (choisi) {
        if (!txt) return { erreur: `« ${nom} » : précisez « Autre »` }
        valeurs[CLE_AUTRE(c.id)] = txt
      }
    }
  }
  return { valeurs }
}

/** Valeur lisible d'une réponse (affichage, export). */
export function valeurLisible(c: Champ, r: Reponses, loc = 'fr-CA'): string {
  const v = r[c.id]
  const autre = r[CLE_AUTRE(c.id)]
  const avecAutre = (x: string) => x === '__autre__' ? `Autre : ${autre ?? ''}` : x
  if (v == null || v === '') return ''
  switch (c.type) {
    case 'choix_multiple': return (v as string[]).map(avecAutre).join(' · ')
    case 'choix_unique': case 'liste': return avecAutre(String(v))
    case 'case': return v === true ? 'Oui' : ''
    case 'date': return String(v)
    case 'date_heure': return String(v).replace('T', ' ')
    case 'signature': { const s = v as { nom: string; le: string }; return `${s.nom} — signé électroniquement le ${new Date(s.le).toLocaleString(loc)}` }
    case 'tableau': return (v as string[][]).map((l, i) => (c.lignes?.[i] ? c.lignes[i] + ' : ' : '') + l.join(' | ')).join('\n')
    default: return String(v)
  }
}

/** Valeurs préremplies pour un employé (fonction pure). */
export function valeursPreremplies(champs: Champ[], e: { prenom?: string | null; nom?: string | null; email?: string | null; poste?: string | null; departement?: string | null }, maintenant = new Date()): Reponses {
  const pad = (n: number) => String(n).padStart(2, '0')
  const jour = `${maintenant.getFullYear()}-${pad(maintenant.getMonth() + 1)}-${pad(maintenant.getDate())}`
  const heure = `${pad(maintenant.getHours())}:${pad(maintenant.getMinutes())}`
  const out: Reponses = {}
  for (const c of champs) {
    if (!c.prerempli) continue
    const v = { nom: [e.prenom, e.nom].filter(Boolean).join(' '), courriel: e.email ?? '', poste: e.poste ?? '', departement: e.departement ?? '', aujourdhui: jour, maintenant: heure }[c.prerempli]
    if (v) out[c.id] = v
  }
  return out
}

/** Numéro affiché d'une réponse (ex. « #000042 »). */
export const numeroReponse = (n: number | string) => '#' + String(n).padStart(6, '0')
