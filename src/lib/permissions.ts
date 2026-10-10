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
import {
  Clinique, CliniqueEmploye, Role,
  cliniquesDe, estCliniqueEmploye, estRole,
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
    .select('id, auth_user_id, prenom, nom, email, role, clinique, departement_id, actif')
    .eq('auth_user_id', user.id)
    .single()

  if (!data || data.actif === false || !estRole(data.role)) return null
  return {
    id: data.id,
    auth_user_id: data.auth_user_id,
    prenom: data.prenom,
    nom: data.nom,
    email: data.email,
    role: data.role,
    clinique: estCliniqueEmploye(data.clinique) ? data.clinique : null,
    departement_id: data.departement_id ?? null,
  }
}

/** Cliniques administrées par l'acteur (vide si gestionnaire/employé). */
export function cliniquesAdministrees(a: Acteur): Clinique[] {
  if (a.role === 'super_admin') return ['CMC', 'WSSC']
  if (a.role === 'admin') return cliniquesDe(a.clinique)
  return []
}

function intersecte(x: Clinique[], y: Clinique[]) { return x.some(c => y.includes(c)) }
function inclus(x: Clinique[], y: Clinique[]) { return x.length > 0 && x.every(c => y.includes(c)) }

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

/** Restreint une requête sur la table employes à la portée de l'acteur. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function filtrerEmployes<Q extends { eq: any; in: any }>(query: Q, a: Acteur): Q {
  if (a.role === 'super_admin') return query
  if (a.role === 'admin') {
    const cl = cliniquesAdministrees(a)
    if (cl.length === 0) return query.eq('id', AUCUN_ID)
    return query.in('clinique', [...cl, 'LES_DEUX'])
  }
  if (a.role === 'gestionnaire' && a.departement_id) {
    return query.eq('departement_id', a.departement_id)
  }
  return query.eq('id', AUCUN_ID)
}

/** L'acteur peut-il consulter le dossier de cet employé ? */
export function peutVoirEmploye(a: Acteur, c: CibleEmploye): boolean {
  if (a.role === 'super_admin') return true
  if (a.role === 'admin') return intersecte(cliniquesDe(c.clinique), cliniquesAdministrees(a))
  if (a.role === 'gestionnaire') return !!a.departement_id && c.departement_id === a.departement_id
  return false
}

/** IDs des employés dans la portée (null = tous, pour l'admin global). */
export async function idsEmployesDansPortee(a: Acteur, sb = serviceClient()): Promise<string[] | null> {
  if (a.role === 'super_admin') return null
  const { data } = await filtrerEmployes(sb.from('employes').select('id'), a)
  return (data ?? []).map((e: { id: string }) => e.id)
}

/** Départements visibles par l'acteur. */
export async function departementsVisibles(a: Acteur, sb = serviceClient()): Promise<DepartementRow[]> {
  let q = sb.from('departements').select('id, nom, clinique').order('nom')
  if (a.role === 'admin') {
    const cl = cliniquesAdministrees(a)
    q = cl.length ? q.in('clinique', cl) : q.eq('id', AUCUN_ID)
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
  if (a.role === 'admin') return !!d.clinique && cliniquesAdministrees(a).includes(d.clinique as Clinique)
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
  if (a.role === 'gestionnaire') {
    return c.role === 'employe' && !!a.departement_id && c.departement_id === a.departement_id
  }
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
  return [] // gestionnaire : clinique déduite de son département
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

  // Gestionnaire : employé de son propre département, clinique = celle du département
  if (a.role === 'gestionnaire') {
    if (!a.departement_id) return { erreur: "Aucun département ne vous est attribué. Contactez un administrateur." }
    const { data: monDept } = await sb.from('departements').select('id, nom, clinique').eq('id', a.departement_id).single()
    return {
      valeurs: {
        role: 'employe',
        departement_id: a.departement_id,
        clinique: (monDept?.clinique as Clinique | null) ?? a.clinique,
      },
    }
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

  if (dept?.clinique && clinique && !cliniquesDe(clinique).includes(dept.clinique)) {
    return { erreur: `Le département « ${dept.nom} » appartient à ${dept.clinique}, qui ne correspond pas à la clinique choisie.` }
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
