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

/** À qui sont envoyées les réponses : les gestionnaires d'un département, ou une personne précise */
export type Destinataire = { type: 'departement' | 'employe'; id: string }

export const MESSAGE_ANONYMAT_DEFAUT = 'Je comprends qu’en choisissant d’envoyer ce formulaire de façon anonyme, mon nom ne sera pas transmis : je ne pourrai pas être contacté(e) pour obtenir des précisions, et je ne recevrai pas de suivi ni de réponse.'

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
  /** Ancien champ (un seul destinataire) ; remplacé par `destinataires` */
  destinataire_id: string | null
  destinataires?: Destinataire[] | null
  /** L'employé peut choisir d'envoyer le formulaire de façon anonyme */
  anonyme_permis?: boolean
  /** Message à accepter pour un envoi anonyme (modifiable par le créateur) */
  message_anonymat?: string | null
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

/** Le module Formulaires est réservé au WSSC. */
export const CLINIQUE_FORMULAIRES: Clinique = 'WSSC'

/** Créer des formulaires : l'administrateur global, ou un administrateur / gestionnaire du WSSC à qui il a donné le droit. */
export function peutCreerFormulaires(a: Acteur | null | undefined): boolean {
  if (!a) return false
  if (a.role === 'super_admin') return true
  if (a.peut_creer_formulaires !== true) return false
  if (a.role === 'admin') return cliniquesAdministrees(a).includes(CLINIQUE_FORMULAIRES)
  return a.role === 'gestionnaire' && cliniquesDe(a.clinique).includes(CLINIQUE_FORMULAIRES)
}

/** Le droit « Gestion des formulaires » peut-il être donné à cette personne ? (admin ou gestionnaire du WSSC) */
export function droitFormulairesPossible(role: string | null | undefined, clinique: string | null | undefined): boolean {
  return (role === 'admin' || role === 'gestionnaire') && cliniquesDe(clinique).includes(CLINIQUE_FORMULAIRES)
}

/** Cliniques possibles pour un formulaire (WSSC seulement). */
export function cliniquesFormulairePossibles(_a: Acteur): ('CMC' | 'WSSC' | 'LES_DEUX')[] {
  return [CLINIQUE_FORMULAIRES]
}

/** Modifier le formulaire : son créateur (s'il a toujours le droit) ou l'administrateur global. */
export function peutModifierFormulaire(a: Acteur, f: Pick<Formulaire, 'cree_par' | 'clinique'>): boolean {
  if (a.role === 'super_admin') return true
  return peutCreerFormulaires(a) && f.cree_par === a.id
}

type FDest = Pick<Formulaire, 'cree_par' | 'destinataire_id' | 'destinataires'>

/** La personne fait-elle partie des destinataires (personne désignée, ou gestionnaire du département désigné) ? */
export function estDestinataire(a: Pick<Acteur, 'id' | 'role' | 'departement_id'>, f: FDest): boolean {
  const l = f.destinataires ?? []
  if (l.some(d => d.type === 'employe' ? d.id === a.id : a.role === 'gestionnaire' && !!a.departement_id && d.id === a.departement_id)) return true
  if (f.destinataire_id) return f.destinataire_id === a.id
  return !l.length && f.cree_par === a.id
}

/** Administrateurs : voient tous les formulaires de leur clinique, avec les statuts. */
export function voitTout(a: Acteur, f: Pick<Formulaire, 'clinique'>): boolean {
  if (a.role === 'super_admin') return true
  if (a.role !== 'admin') return false
  const cl = cliniquesDe(f.clinique)
  return cl.length > 0 && cl.every(c => cliniquesAdministrees(a).includes(c))
}

/** Consulter les réponses : administrateurs (tout), créateur, destinataires (seulement ceux qui leur sont assignés). */
export function peutVoirReponses(a: Acteur, f: FDest & Pick<Formulaire, 'clinique'>): boolean {
  return voitTout(a, f) || f.cree_par === a.id || estDestinataire(a, f)
}

/** Compatibilité : premier destinataire « personne » (ou le créateur). */
export function destinataireDe(f: FDest): string | null {
  return (f.destinataires ?? []).find(d => d.type === 'employe')?.id ?? f.destinataire_id ?? ((f.destinataires ?? []).length ? null : f.cree_par)
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
export function validerReponses(champs: Champ[], brut: unknown, partie: 'employe' | 'reserve', options: { anonyme?: boolean } = {}): { valeurs: Reponses } | { erreur: string } {
  const r = (brut && typeof brut === 'object' ? brut : {}) as Record<string, unknown>
  const valeurs: Reponses = {}
  for (const c of champsAvecReserve(champs)) {
    if (!estSaisissable(c) || c.estReserve !== (partie === 'reserve')) continue
    if (options.anonyme && estChampIdentite(c)) continue // jamais transmis pour un envoi anonyme
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

/** Champs qui identifient l'employé : masqués et ignorés lors d'un envoi anonyme. */
export function estChampIdentite(c: Champ): boolean {
  return c.type === 'signature' || ['nom', 'courriel', 'poste', 'departement'].includes(c.prerempli ?? '')
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
