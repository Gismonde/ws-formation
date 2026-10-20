// Règles d'accès centralisées (côté serveur uniquement).
//
//   super_admin  : tout, dans les deux cliniques
//   admin        : tout, pour les employés de SA clinique (employes.clinique de l'admin)
//   gestionnaire : employés (rôle « employe ») de SON département ; création dans son département
//   employe      : aucun accès à l'espace Admin, seulement son propre profil
//
// Toutes les pages/API Admin passent par ce module : ne pas dupliquer ces règles ailleurs.

import { createClient as createServiceClient, SupabaseClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import {
  Clinique, CliniqueEmploye, CliniqueContenu, Role,
  cliniquesDe, estCliniqueEmploye, estRole, VUE_ADMIN_COOKIE, vuesAdminPossibles,
} from '@/lib/cliniques'

export type Acteur = {
  id: string
  auth_user_id: string
  prenom: string | null
  nom: string | null
  email: string | null
  role: Role
  clinique: CliniqueEmploye | null
  departement_id: string | null
  /** Gestionnaire autorisé à créer/modifier des formations (les admins le sont toujours) */
  peut_creer_formations: boolean
  /**
   * Vue choisie dans l'espace Admin par une personne rattachée aux deux cliniques (ou l'admin global) :
   * CMC ou WSSC, null = les deux. Ne fait que RÉDUIRE la portée, jamais l'élargir.
   */
  vue?: Clinique | null
}

export type CibleEmploye = {
  id?: string
  role?: string | null
  clinique?: string | null
  departement_id?: string | null
}

export type DepartementRow = { id: string; nom: string; clinique: Clinique | null }

const AUCUN_ID = '00000000-0000-0000-0000-000000000000'

export function serviceClient(): SupabaseClient {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/** Employé connecté (null si non connecté, introuvable ou archivé). */
export async function getActeur(): Promise<Acteur | null> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await serviceClient()
    .from('employes')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  if (!data || data.actif === false || !estRole(data.role)) return null
  const clinique = estCliniqueEmploye(data.clinique) ? data.clinique : null
  let vue: Clinique | null = null
  try {
    const choix = (await cookies()).get(VUE_ADMIN_COOKIE)?.value
    if (vuesAdminPossibles(clinique, data.role).includes(choix as Clinique)) vue = choix as Clinique
  } catch { /* hors requête (tâche planifiée) : pas de vue */ }
  return {
    id: data.id,
    auth_user_id: data.auth_user_id,
    prenom: data.prenom,
    nom: data.nom,
    email: data.email,
    role: data.role,
    clinique,
    departement_id: data.departement_id ?? null,
    peut_creer_formations: data.peut_creer_formations === true,
    vue,
  }
}

// ---------------------------------------------------------------------------
// Création de formations
// ---------------------------------------------------------------------------

/** Admins : toujours. Gestionnaires : seulement si l'autorisation leur a été donnée. */
export function peutCreerFormations(a: Acteur | null): boolean {
  if (!a) return false
  if (a.role === 'super_admin' || a.role === 'admin') return true
  return a.role === 'gestionnaire' && a.peut_creer_formations
}

/** Acteur connecté s'il peut créer/modifier des formations, sinon null. */
export async function getCreateurFormations(): Promise<Acteur | null> {
  const a = await getActeur()
  return peutCreerFormations(a) ? a : null
}

/** Cliniques administrées par l'acteur (vide si gestionnaire/employé). */
export function cliniquesAdministrees(a: Acteur): Clinique[] {
  const base: Clinique[] = a.role === 'super_admin' ? ['CMC', 'WSSC'] : a.role === 'admin' ? cliniquesDe(a.clinique) : []
  return dansLaVue(a, base)
}

/** Restreint une liste de cliniques à la vue choisie (si elle en fait partie). */
function dansLaVue<T extends string>(a: Acteur, liste: T[]): T[] {
  if (!a.vue) return liste
  return liste.filter(c => c === a.vue || c === 'LES_DEUX')
}

// ---------------------------------------------------------------------------
// Contenus rattachés à une clinique (formations, SOP)
// Mêmes règles que les fonctions SQL peut_voir_contenu_clinique / peut_gerer_contenu_clinique
// (supabase/migrations/formations_sop_par_clinique.sql).
// ---------------------------------------------------------------------------

/** Cliniques de contenu que l'acteur peut VOIR dans l'espace Admin (tous rôles). */
export function cliniquesContenuVisibles(a: Acteur): CliniqueContenu[] {
  if (a.role === 'super_admin') return dansLaVue<CliniqueContenu>(a, ['CMC', 'WSSC', 'LES_DEUX'])
  return dansLaVue<CliniqueContenu>(a, [...cliniquesDe(a.clinique), 'LES_DEUX'])
}

/**
 * Cliniques pour lesquelles l'acteur peut CRÉER / MODIFIER du contenu.
 *  - admin global : CMC, WSSC et les deux
 *  - admin / gestionnaire autorisé rattaché aux deux cliniques : CMC, WSSC et les deux
 *  - admin / gestionnaire autorisé d'une seule clinique : cette clinique seulement
 */
export function cliniquesContenuGerables(a: Acteur): CliniqueContenu[] {
  if (a.role === 'super_admin') return dansLaVue<CliniqueContenu>(a, ['CMC', 'WSSC', 'LES_DEUX'])
  if (!peutCreerFormations(a)) return []
  if (a.clinique === 'LES_DEUX') return dansLaVue<CliniqueContenu>(a, ['CMC', 'WSSC', 'LES_DEUX'])
  return dansLaVue<CliniqueContenu>(a, cliniquesDe(a.clinique))
}

export function peutVoirContenu(a: Acteur, clinique: string | null | undefined): boolean {
  return cliniquesContenuVisibles(a).includes((clinique ?? 'LES_DEUX') as CliniqueContenu)
}

export function peutGererContenu(a: Acteur, clinique: string | null | undefined): boolean {
  return cliniquesContenuGerables(a).includes((clinique ?? 'LES_DEUX') as CliniqueContenu)
}

/** Un employé peut-il recevoir un contenu de cette clinique ? (assignation) */
export function employeConcerneParClinique(cliniqueEmploye: string | null | undefined, clinique: string | null | undefined): boolean {
  if (!clinique || clinique === 'LES_DEUX') return true
  return cliniquesDe(cliniqueEmploye).includes(clinique as Clinique)
}

function intersecte(x: Clinique[], y: Clinique[]) { return x.some(c => y.includes(c)) }
function inclus(x: Clinique[], y: Clinique[]) { return x.length > 0 && x.every(c => y.includes(c)) }

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

/** Restreint une requête sur la table employes à la portée de l'acteur. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function filtrerEmployes<Q extends { eq: any; in: any }>(query: Q, a: Acteur): Q {
  if (a.role === 'super_admin') return a.vue ? query.in('clinique', [a.vue, 'LES_DEUX']) : query
  if (a.role === 'admin') {
    const cl = cliniquesAdministrees(a)
    if (cl.length === 0) return query.eq('id', AUCUN_ID)
    return query.in('clinique', [...cl, 'LES_DEUX'])
  }
  if (a.role === 'gestionnaire' && a.departement_id) {
    // Son département, dans sa clinique (les départements sont communs aux deux cliniques)
    const cl = dansLaVue(a, cliniquesDe(a.clinique))
    if (cl.length === 0) return query.eq('id', AUCUN_ID)
    return query.eq('departement_id', a.departement_id).in('clinique', [...cl, 'LES_DEUX'])
  }
  return query.eq('id', AUCUN_ID)
}

/** L'acteur peut-il consulter le dossier de cet employé ? */
export function peutVoirEmploye(a: Acteur, c: CibleEmploye): boolean {
  if (a.role === 'super_admin') return !a.vue || cliniquesDe(c.clinique).includes(a.vue)
  if (a.role === 'admin') return intersecte(cliniquesDe(c.clinique), cliniquesAdministrees(a))
  if (a.role === 'gestionnaire') {
    return !!a.departement_id && c.departement_id === a.departement_id
      && intersecte(cliniquesDe(c.clinique), dansLaVue(a, cliniquesDe(a.clinique)))
  }
  return false
}

/** IDs des employés dans la portée (null = tous, pour l'admin global). */
export async function idsEmployesDansPortee(a: Acteur, sb = serviceClient()): Promise<string[] | null> {
  if (a.role === 'super_admin' && !a.vue) return null
  const { data } = await filtrerEmployes(sb.from('employes').select('id'), a)
  return (data ?? []).map((e: { id: string }) => e.id)
}

/** Départements visibles par l'acteur (liste commune aux deux cliniques). */
export async function departementsVisibles(a: Acteur, sb = serviceClient()): Promise<DepartementRow[]> {
  let q = sb.from('departements').select('id, nom, clinique').order('nom')
  if (a.role === 'admin') {
    if (cliniquesAdministrees(a).length === 0) q = q.eq('id', AUCUN_ID)
  } else if (a.role === 'gestionnaire') {
    q = q.eq('id', a.departement_id ?? AUCUN_ID)
  } else if (a.role !== 'super_admin') {
    q = q.eq('id', AUCUN_ID)
  }
  const { data } = await q
  return (data ?? []) as DepartementRow[]
}

export function peutVoirDepartement(a: Acteur, d: { id: string; clinique: string | null }): boolean {
  if (a.role === 'super_admin') return true
  if (a.role === 'admin') return cliniquesAdministrees(a).length > 0
  if (a.role === 'gestionnaire') return d.id === a.departement_id
  return false
}

// ---------------------------------------------------------------------------
// Écriture
// ---------------------------------------------------------------------------

/** L'acteur peut-il modifier / archiver / assigner cet employé ? */
export function peutGererEmploye(a: Acteur, c: CibleEmploye): boolean {
  if (c.id && c.id === a.id) return false // pas de gestion de son propre compte via l'admin
  if (a.role === 'super_admin') return true
  if (a.role === 'admin') {
    if (c.role === 'super_admin') return false
    if (!peutVoirEmploye(a, c)) return false
    // Un admin de clinique ne gère un autre admin que si celui-ci est entièrement dans sa/ses clinique(s)
    if (c.role === 'admin') return inclus(cliniquesDe(c.clinique), cliniquesAdministrees(a))
    return true
  }
  if (a.role === 'gestionnaire') return c.role === 'employe' && peutVoirEmploye(a, c)
  return false
}

export function rolesAttribuables(a: Acteur): Role[] {
  if (a.role === 'super_admin') return ['super_admin', 'admin', 'gestionnaire', 'employe']
  if (a.role === 'admin') return ['admin', 'gestionnaire', 'employe']
  if (a.role === 'gestionnaire') return ['employe']
  return []
}

export function cliniquesAttribuables(a: Acteur): CliniqueEmploye[] {
  if (a.role === 'super_admin') return ['CMC', 'WSSC', 'LES_DEUX']
  if (a.role === 'admin') {
    const cl = cliniquesAdministrees(a)
    return cl.length ? [...cl, 'LES_DEUX'] : []
  }
  if (a.role === 'gestionnaire') return a.clinique ? [a.clinique] : []
  return []
}

export type Attribution = {
  role: Role
  clinique: CliniqueEmploye | null
  departement_id: string | null
}

/**
 * Valide (et complète) le rôle / la clinique / le département qu'un acteur veut donner à un employé.
 * Retourne { erreur } ou { valeurs } prêtes à enregistrer.
 */
export async function validerAttribution(
  a: Acteur,
  demande: { role?: unknown; clinique?: unknown; departement_id?: unknown },
  sb = serviceClient()
): Promise<{ erreur: string } | { valeurs: Attribution }> {
  const role = demande.role ?? 'employe'
  if (!estRole(role) || !rolesAttribuables(a).includes(role)) {
    return { erreur: "Vous n'êtes pas autorisé à attribuer ce rôle." }
  }

  const departement_id = typeof demande.departement_id === 'string' && demande.departement_id ? demande.departement_id : null
  let dept: DepartementRow | null = null
  if (departement_id) {
    const { data } = await sb.from('departements').select('id, nom, clinique').eq('id', departement_id).single()
    if (!data) return { erreur: 'Département introuvable.' }
    dept = data as DepartementRow
    if (!peutVoirDepartement(a, dept)) return { erreur: 'Ce département est hors de votre périmètre.' }
  }

  // Gestionnaire : employé de son propre département, dans sa propre clinique
  if (a.role === 'gestionnaire') {
    if (!a.departement_id || !a.clinique) {
      return { erreur: "Aucun département ou aucune clinique ne vous est attribué. Contactez un administrateur." }
    }
    return { valeurs: { role: 'employe', departement_id: a.departement_id, clinique: a.clinique } }
  }

  const clinique = demande.clinique === '' || demande.clinique == null ? null : demande.clinique
  if (clinique !== null && !estCliniqueEmploye(clinique)) return { erreur: 'Clinique invalide.' }

  if (role !== 'super_admin' && !clinique) return { erreur: 'Veuillez choisir une clinique.' }
  if (role === 'gestionnaire' && !departement_id) return { erreur: 'Un gestionnaire doit avoir un département.' }

  if (a.role === 'admin') {
    if (!clinique || !cliniquesAttribuables(a).includes(clinique)) {
      return { erreur: 'Cette clinique est hors de votre périmètre.' }
    }
    if (role === 'admin' && !inclus(cliniquesDe(clinique), cliniquesAdministrees(a))) {
      return { erreur: "Vous ne pouvez nommer un administrateur que pour votre propre clinique." }
    }
  }

  return { valeurs: { role, clinique: clinique as CliniqueEmploye | null, departement_id } }
}

export function ipEtAgent(req: Request) {
  const ipRaw = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip')
  return {
    ip_address: ipRaw ? ipRaw.split(',')[0].trim() : null,
    user_agent: req.headers.get('user-agent') ?? null,
  }
}

/** Libellé court de la portée de l'acteur (rapports, exports). */
export function libellePerimetre(a: Acteur): string {
  if (a.role === 'gestionnaire') return 'mon département'
  const cl = cliniquesAdministrees(a)
  return cl.length ? cl.join(' + ') : 'aucune clinique'
}
