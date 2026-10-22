// Politiques de la clinique : ciblage (clinique + départements), droits et statistiques de confirmation.
// Côté serveur uniquement.
import type { SupabaseClient } from '@supabase/supabase-js'
import { Acteur, cliniquesAdministrees, filtrerEmployes } from '@/lib/permissions'
import { Clinique, CliniqueEmploye, cliniquesDe } from '@/lib/cliniques'

export const TEXTE_CONFIRMATION_POLITIQUE =
  'J’ai lu et compris cette politique et je m’engage à la respecter.'
export const TEXTE_CONFIRMATION_POLITIQUE_EN =
  'I have read and understood this policy and I agree to comply with it.'

/** Texte de l'engagement dans la langue de l'employé (celui affiché est celui conservé comme preuve). */
export function texteConfirmationPolitique(langue: 'fr' | 'en'): string {
  return langue === 'en' ? TEXTE_CONFIRMATION_POLITIQUE_EN : TEXTE_CONFIRMATION_POLITIQUE
}

export type Politique = {
  id: string
  titre: string
  description: string | null
  clinique: CliniqueEmploye
  departements: string[]
  /** Employés visés individuellement (colonne ajoutée par politiques_employes.sql ; absente = aucun) */
  employes?: string[] | null
  /** Rôles visés (gestionnaire, admin…) — colonne ajoutée par politiques_roles_postes.sql */
  roles?: string[] | null
  /** Postes / titres visés (ex. « Infirmière ») — même migration */
  postes?: string[] | null
  version: number
  fichier: string
  nom_fichier: string | null
  note_version: string | null
  publiee_le: string
  publiee_par: string | null
  actif: boolean
  created_at: string
}

export type EmployeVise = {
  id: string
  prenom: string | null
  nom: string | null
  email: string | null
  role: string | null
  clinique: string | null
  departement_id: string | null
  poste?: string | null
  actif?: boolean | null
}

const intersecte = (x: Clinique[], y: Clinique[]) => x.some(c => y.includes(c))

/** Clinique effective d'un employé (l'admin global sans clinique couvre les deux). */
function cliniquesEmploye(e: { clinique: string | null; role?: string | null }): Clinique[] {
  if (!e.clinique && e.role === 'super_admin') return ['CMC', 'WSSC']
  return cliniquesDe(e.clinique)
}

export type CiblePolitique = Pick<Politique, 'clinique' | 'departements'> & { employes?: string[] | null; roles?: string[] | null; postes?: string[] | null }

/** Rôles qu'on peut viser (l'administrateur global compte comme administrateur). */
export const ROLES_CIBLABLES = ['gestionnaire', 'admin'] as const

const normPoste = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * L'employé fait-il partie du public visé par la politique ?
 * Dans la clinique : toute la clinique si aucun ciblage, sinon l'employé correspond à AU MOINS un critère
 * (département, employé désigné, rôle ou poste).
 */
export function estVise(
  p: CiblePolitique,
  e: { id?: string; clinique: string | null; role?: string | null; departement_id: string | null; poste?: string | null },
): boolean {
  if (!intersecte(cliniquesDe(p.clinique), cliniquesEmploye(e))) return false
  if (estPourToute(p)) return true
  const depts = p.departements ?? []
  const emps = p.employes ?? []
  const roles = p.roles ?? []
  const postes = (p.postes ?? []).map(normPoste)
  const role = e.role === 'super_admin' ? 'admin' : e.role
  return (!!e.departement_id && depts.includes(e.departement_id))
    || (!!e.id && emps.includes(e.id))
    || (!!role && roles.includes(role))
    || (!!e.poste && postes.includes(normPoste(e.poste)))
}

/** La politique s'adresse-t-elle à toute sa clinique (aucun critère de ciblage) ? */
export function estPourToute(p: { departements?: string[] | null; employes?: string[] | null; roles?: string[] | null; postes?: string[] | null }): boolean {
  return !(p.departements ?? []).length && !(p.employes ?? []).length && !(p.roles ?? []).length && !(p.postes ?? []).length
}

// ---------------------------------------------------------------------------
// Droits

/** Seuls les administrateurs publient des politiques. */
export function peutPublierPolitiques(a: Acteur): boolean {
  return a.role === 'super_admin' || (a.role === 'admin' && cliniquesAdministrees(a).length > 0)
}

/** Valeurs de clinique qu'un administrateur peut choisir pour une politique. */
export function cliniquesPolitiquePossibles(a: Acteur): CliniqueEmploye[] {
  const cl = cliniquesAdministrees(a)
  if (cl.length === 2) return ['LES_DEUX', 'CMC', 'WSSC']
  return cl
}

/** Modifier / nouvelle version / archiver : la politique doit être entièrement dans ses cliniques. */
export function peutGererPolitique(a: Acteur, p: Pick<Politique, 'clinique'>): boolean {
  if (!peutPublierPolitiques(a)) return false
  const cl = cliniquesDe(p.clinique)
  const adm = cliniquesAdministrees(a)
  return cl.length > 0 && cl.every(c => adm.includes(c))
}

/** Consulter la politique et ses statistiques (dans sa portée). */
export function peutSuivrePolitique(a: Acteur, p: CiblePolitique): boolean {
  if (a.role === 'super_admin' || a.role === 'admin') return intersecte(cliniquesDe(p.clinique), cliniquesAdministrees(a))
  if (a.role === 'gestionnaire') {
    if (!a.departement_id) return false
    return estVise(p, { id: a.id, clinique: a.clinique, departement_id: a.departement_id, role: a.role, poste: a.poste })
  }
  return false
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Valide titre / clinique / public, communs à la création et à la modification.
 * `rolesPostes` : les colonnes roles / postes existent (migration exécutée) ; sinon elles ne sont pas écrites.
 */
export async function validerCiblage(acteur: Acteur, body: Record<string, unknown>, sb: SupabaseClient, rolesPostes = true) {
  const titre = String(body.titre ?? '').trim().slice(0, 300)
  if (!titre) return { erreur: 'Le titre est obligatoire' }
  const clinique = body.clinique as CliniqueEmploye
  if (!cliniquesPolitiquePossibles(acteur).includes(clinique)) return { erreur: 'Clinique non autorisée' }
  const liste = (v: unknown) => (Array.isArray(v) ? Array.from(new Set(v.map(x => String(x).trim()).filter(Boolean))) : [])
  const departements = liste(body.departements)
  if (departements.length) {
    const { data } = await sb.from('departements').select('id').in('id', departements)
    if ((data ?? []).length !== departements.length) return { erreur: 'Département inconnu' }
  }
  const employes = liste(body.employes).filter(x => UUID.test(x)).slice(0, 500)
  if (employes.length) {
    const { data } = await sb.from('employes').select('id').in('id', employes)
    if ((data ?? []).length !== employes.length) return { erreur: 'Employé inconnu' }
  }
  const roles = liste(body.roles).filter(r => (ROLES_CIBLABLES as readonly string[]).includes(r))
  const postes = liste(body.postes).map(x => x.slice(0, 120)).slice(0, 50)
  if (!rolesPostes && (roles.length || postes.length)) {
    return { erreur: 'Le ciblage par rôle ou par poste demande une mise à jour de la base de données (politiques_roles_postes.sql).' }
  }
  return {
    valeurs: {
      titre, description: String(body.description ?? '').trim() || null, clinique, departements, employes,
      ...(rolesPostes ? { roles, postes } : {}),
    },
  }
}

/** Les colonnes roles / postes existent-elles ? (migration politiques_roles_postes.sql) */
export async function colonnesRolesPostes(sb: SupabaseClient): Promise<boolean> {
  const { error } = await sb.from('politiques').select('roles, postes').limit(1)
  return !error
}

// ---------------------------------------------------------------------------
// Statistiques

export type StatPolitique = {
  vises: EmployeVise[]
  confirmations: Record<string, { confirme_le: string; texte: string }>
  total: number
  confirmes: number
  pourcentage: number
}

/** Employés actifs dans la portée de l'acteur (base des statistiques). */
export async function employesDansPortee(sb: SupabaseClient, a: Acteur): Promise<EmployeVise[]> {
  const { data } = await filtrerEmployes(
    sb.from('employes').select('id, prenom, nom, email, role, clinique, departement_id, poste, actif').or('actif.is.null,actif.eq.true'),
    a,
  )
  return (data ?? []) as EmployeVise[]
}

/** Calcule, pour chaque politique, le taux de confirmation de la version en vigueur dans la portée de l'acteur. */
export async function statistiquesPolitiques(
  sb: SupabaseClient, politiques: Politique[], employes: EmployeVise[],
): Promise<Record<string, StatPolitique>> {
  const res: Record<string, StatPolitique> = {}
  if (politiques.length === 0) return res
  const { data: confs } = await sb.from('politiques_confirmations')
    .select('politique_id, version, employe_id, confirme_le, texte')
    .in('politique_id', politiques.map(p => p.id))
  for (const p of politiques) {
    const vises = employes.filter(e => estVise(p, e))
    const ids = new Set(vises.map(v => v.id))
    const confirmations: StatPolitique['confirmations'] = {}
    for (const c of confs ?? []) {
      if (c.politique_id === p.id && c.version === p.version && ids.has(c.employe_id)) {
        confirmations[c.employe_id] = { confirme_le: c.confirme_le, texte: c.texte }
      }
    }
    const confirmes = Object.keys(confirmations).length
    res[p.id] = {
      vises, confirmations, total: vises.length, confirmes,
      pourcentage: vises.length ? Math.round((confirmes / vises.length) * 100) : 0, // 0/0 : voir « Aucun employé visé » à l'affichage
    }
  }
  return res
}

/** Politiques actives qui s'adressent à cet employé, avec son statut pour la version en vigueur. */
/**
 * Politiques visées pour l'employé.
 * `espace` (CMC / WSSC) : n'afficher que les politiques de cet espace (employé rattaché aux deux cliniques).
 */
export async function politiquesDeLEmploye(sb: SupabaseClient, e: { id: string; clinique: string | null; role?: string | null; departement_id: string | null; poste?: string | null }, espace?: Clinique | null) {
  const { data } = await sb.from('politiques').select('*').eq('actif', true).order('publiee_le', { ascending: false })
  const pols = ((data ?? []) as Politique[])
    .filter(p => estVise(p, e))
    .filter(p => !espace || cliniquesDe(p.clinique).includes(espace))
  if (pols.length === 0) return []
  const { data: confs } = await sb.from('politiques_confirmations')
    .select('politique_id, version, confirme_le').eq('employe_id', e.id).in('politique_id', pols.map(p => p.id))
  return pols.map(p => {
    const miennes = (confs ?? []).filter(c => c.politique_id === p.id)
    const actuelle = miennes.find(c => c.version === p.version)
    return {
      ...p,
      confirme_le: actuelle?.confirme_le ?? null,
      /** A confirmé une version précédente mais pas la version en vigueur */
      a_reconfirmer: !actuelle && miennes.length > 0,
    }
  })
}

/** Nombre de politiques en attente de confirmation (pour le badge du menu). */
export async function nombrePolitiquesEnAttente(sb: SupabaseClient, e: { id: string; clinique: string | null; role?: string | null; departement_id: string | null; poste?: string | null }, espace?: Clinique | null) {
  try {
    return (await politiquesDeLEmploye(sb, e, espace)).filter(p => !p.confirme_le).length
  } catch {
    return 0 // table absente (script SQL pas encore exécuté) : ne bloque pas le menu
  }
}

/** Données du formulaire de ciblage : départements, postes existants et employés de la portée de l'acteur. */
export async function optionsCiblage(sb: SupabaseClient, a: Acteur) {
  const [{ data: departements }, employes, rolesPostes] = await Promise.all([
    sb.from('departements').select('id, nom').order('nom'),
    employesDansPortee(sb, a),
    colonnesRolesPostes(sb),
  ])
  const nomDep = new Map((departements ?? []).map(d => [d.id as string, d.nom as string]))
  // Postes distincts (sans tenir compte des majuscules / accents), triés
  const postes = new Map<string, string>()
  for (const e of employes) {
    const p = (e.poste ?? '').trim()
    if (p && !postes.has(normPoste(p))) postes.set(normPoste(p), p)
  }
  return {
    departements: (departements ?? []) as { id: string; nom: string }[],
    postes: Array.from(postes.values()).sort((x, y) => x.localeCompare(y, 'fr')),
    employes: employes.map(e => ({
      id: e.id, nom: `${e.prenom ?? ''} ${e.nom ?? ''}`.trim() || (e.email ?? ''), poste: e.poste ?? null,
      clinique: e.clinique, departement: (e.departement_id && nomDep.get(e.departement_id)) || null,
    })).sort((x, y) => x.nom.localeCompare(y.nom, 'fr')),
    rolesPostes,
  }
}
