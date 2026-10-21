// Import d'employés depuis un fichier Excel ou CSV : lecture des lignes, reconnaissance des colonnes
// et validation de chaque ligne avant création. Fonctions pures (testées) ; la lecture .xlsx est faite côté API.
import type { CliniqueEmploye, Role } from '@/lib/cliniques'

export const MAX_LIGNES_IMPORT = 300

export type ColonneImport = 'prenom' | 'nom' | 'email' | 'poste' | 'clinique' | 'departement' | 'role'

/** Codes d'erreur d'une ligne ; le libellé est traduit dans l'interface. */
export type ErreurImport =
  | 'prenom_manquant' | 'nom_manquant' | 'email_manquant' | 'email_invalide' | 'email_double_fichier'
  | 'email_existant' | 'clinique_invalide' | 'clinique_hors_perimetre' | 'departement_introuvable'
  | 'role_invalide' | 'role_non_autorise' | 'gestionnaire_sans_departement'

export type LigneImport = {
  numero: number // numéro de ligne dans le fichier (en-tête = 1)
  prenom: string
  nom: string
  email: string
  poste: string
  role: Role
  clinique: CliniqueEmploye | null
  departement_id: string | null
  departement_nom: string
  erreurs: ErreurImport[]
}

export type ContexteImport = {
  departements: { id: string; nom: string; clinique: string | null }[]
  cliniquesPossibles: CliniqueEmploye[]
  rolesPossibles: Role[]
  emailsExistants: Set<string>
  /** Gestionnaire : tous les employés importés vont dans son département et sa clinique. */
  imposer?: { clinique: CliniqueEmploye; departement_id: string } | null
}

export const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

const ALIAS: Record<ColonneImport, string[]> = {
  prenom: ['prenom', 'first name', 'firstname', 'given name'],
  nom: ['nom', 'nom de famille', 'last name', 'lastname', 'surname', 'family name'],
  email: ['courriel', 'email', 'e-mail', 'adresse courriel', 'mail', 'adresse email', 'adresse e-mail'],
  poste: ['poste', 'titre', 'fonction', 'job title', 'title', 'position'],
  clinique: ['clinique', 'clinic', 'site'],
  departement: ['departement', 'department', 'service', 'equipe', 'team'],
  role: ['role'],
}

/** Associe chaque colonne connue à son index dans l'en-tête. */
export function reconnaitreColonnes(entete: string[]): Partial<Record<ColonneImport, number>> {
  const res: Partial<Record<ColonneImport, number>> = {}
  entete.forEach((cellule, i) => {
    const c = sansAccents(cellule).replace(/[*:]/g, '').replace(/\s+/g, ' ').trim()
    for (const [col, alias] of Object.entries(ALIAS) as [ColonneImport, string[]][]) {
      if (res[col] === undefined && alias.includes(c)) res[col] = i
    }
  })
  return res
}

/** Lit un CSV (séparateur « , » ou « ; », guillemets, retours à la ligne entre guillemets). */
export function lireCsv(texte: string): string[][] {
  const t = texte.replace(/^﻿/, '')
  const premiere = t.split(/\r?\n/, 1)[0] ?? ''
  const sep = (premiere.match(/;/g)?.length ?? 0) > (premiere.match(/,/g)?.length ?? 0) ? ';' : (premiere.includes('\t') && !premiere.includes(',') ? '\t' : ',')
  const lignes: string[][] = []
  let ligne: string[] = []
  let champ = ''
  let guillemets = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (guillemets) {
      if (c === '"') {
        if (t[i + 1] === '"') { champ += '"'; i++ } else guillemets = false
      } else champ += c
    } else if (c === '"') guillemets = true
    else if (c === sep) { ligne.push(champ); champ = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      ligne.push(champ); lignes.push(ligne); ligne = []; champ = ''
    } else champ += c
  }
  if (champ !== '' || ligne.length) { ligne.push(champ); lignes.push(ligne) }
  return lignes.map(l => l.map(x => x.trim())).filter(l => l.some(x => x !== ''))
}

export function lireClinique(v: string): CliniqueEmploye | null | 'invalide' {
  const s = sansAccents(v).replace(/[^a-z]/g, '')
  if (!s) return null
  if (s === 'cmc') return 'CMC'
  if (s === 'wssc') return 'WSSC'
  if (['lesdeux', 'deux', 'both', 'lesdeuxcmcwssc', 'cmcwssc', 'wssccmc'].includes(s)) return 'LES_DEUX'
  return 'invalide'
}

export function lireRole(v: string): Role | 'invalide' {
  const s = sansAccents(v).replace(/[^a-z]/g, '')
  if (!s || ['employe', 'employee', 'staff'].includes(s)) return 'employe'
  if (['gestionnaire', 'manager', 'gestionnairededepartement'].includes(s)) return 'gestionnaire'
  if (['admin', 'administrateur', 'administrateurdeclinique', 'administrator'].includes(s)) return 'admin'
  return 'invalide'
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Transforme les lignes brutes (en-tête compris) en lignes validées. */
export function analyserImport(brutes: string[][], ctx: ContexteImport): { lignes: LigneImport[]; colonnesManquantes: ColonneImport[] } {
  const [entete = [], ...corps] = brutes
  const col = reconnaitreColonnes(entete)
  const colonnesManquantes = (['prenom', 'nom', 'email'] as ColonneImport[]).filter(c => col[c] === undefined)
  if (colonnesManquantes.length) return { lignes: [], colonnesManquantes }

  const val = (l: string[], c: ColonneImport) => (col[c] === undefined ? '' : String(l[col[c]!] ?? '').trim())
  const vus = new Map<string, number>()
  const lignes = corps.slice(0, MAX_LIGNES_IMPORT).map((l, i): LigneImport => {
    const erreurs: ErreurImport[] = []
    const prenom = val(l, 'prenom')
    const nom = val(l, 'nom')
    const email = val(l, 'email').toLowerCase()
    if (!prenom) erreurs.push('prenom_manquant')
    if (!nom) erreurs.push('nom_manquant')
    if (!email) erreurs.push('email_manquant')
    else if (!EMAIL.test(email)) erreurs.push('email_invalide')
    else if (vus.has(email)) erreurs.push('email_double_fichier')
    else if (ctx.emailsExistants.has(email)) erreurs.push('email_existant')
    if (email) vus.set(email, i)

    let role: Role = 'employe'
    let clinique: CliniqueEmploye | null = null
    let departement_id: string | null = null
    let departement_nom = val(l, 'departement')

    if (ctx.imposer) {
      clinique = ctx.imposer.clinique
      departement_id = ctx.imposer.departement_id
      departement_nom = ctx.departements.find(d => d.id === departement_id)?.nom ?? departement_nom
    } else {
      const r = lireRole(val(l, 'role'))
      if (r === 'invalide') erreurs.push('role_invalide')
      else if (!ctx.rolesPossibles.includes(r) || r === 'super_admin') erreurs.push('role_non_autorise')
      else role = r

      const c = lireClinique(val(l, 'clinique'))
      if (c === 'invalide') erreurs.push('clinique_invalide')
      else if (c === null && ctx.cliniquesPossibles.length === 1) clinique = ctx.cliniquesPossibles[0]
      else if (c === null || !ctx.cliniquesPossibles.includes(c)) erreurs.push(c === null ? 'clinique_invalide' : 'clinique_hors_perimetre')
      else clinique = c

      if (departement_nom) {
        const cle = sansAccents(departement_nom)
        const candidats = ctx.departements.filter(d => sansAccents(d.nom) === cle)
        const d = candidats.find(x => clinique && x.clinique === clinique) ?? candidats.find(x => !x.clinique || x.clinique === 'LES_DEUX') ?? candidats[0]
        if (!d) erreurs.push('departement_introuvable')
        else { departement_id = d.id; departement_nom = d.nom }
      }
      if (role === 'gestionnaire' && !departement_id && !erreurs.includes('departement_introuvable')) erreurs.push('gestionnaire_sans_departement')
    }

    return { numero: i + 2, prenom, nom, email, poste: val(l, 'poste'), role, clinique, departement_id, departement_nom, erreurs }
  })
  return { lignes, colonnesManquantes }
}
