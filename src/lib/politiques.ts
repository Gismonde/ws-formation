// Politiques de la clinique : ciblage (clinique + départements), droits et statistiques de confirmation.
// Côté serveur uniquement.
import type { SupabaseClient } from '@supabase/supabase-js'
import { Acteur, cliniquesAdministrees, filtrerEmployes } from '@/lib/permissions'
import { Clinique, CliniqueEmploye, cliniquesDe } from '@/lib/cliniques'

export const TEXTE_CONFIRMATION_POLITIQUE =
  'J’ai lu et compris cette politique et je m’engage à la respecter.'

export type Politique = {
  id: string
  titre: string
  description: string | null
  clinique: CliniqueEmploye
  departements: string[]
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
  actif?: boolean | null
}

const intersecte = (x: Clinique[], y: Clinique[]) => x.some(c => y.includes(c))

/** Clinique effective d'un employé (l'admin global sans clinique couvre les deux). */
function cliniquesEmploye(e: { clinique: string | null; role?: string | null }): Clinique[] {
  if (!e.clinique && e.role === 'super_admin') return ['CMC', 'WSSC']
  return cliniquesDe(e.clinique)
}

/** L'employé fait-il partie du public visé par la politique ? */
export function estVise(p: Pick<Politique, 'clinique' | 'departements'>, e: { clinique: string | null; role?: string | null; departement_id: string | null }): boolean {
  if (!intersecte(cliniquesDe(p.clinique), cliniquesEmploye(e))) return false
  if (!p.departements || p.departements.length === 0) return true
  return !!e.departement_id && p.departements.includes(e.departement_id)
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
export function peutSuivrePolitique(a: Acteur, p: Pick<Politique, 'clinique' | 'departements'>): boolean {
  if (a.role === 'super_admin' || a.role === 'admin') return intersecte(cliniquesDe(p.clinique), cliniquesAdministrees(a))
  if (a.role === 'gestionnaire') {
    if (!a.departement_id) return false
    return estVise(p, { clinique: a.clinique, departement_id: a.departement_id })
  }
  return false
}

/** Valide titre / clinique / départements communs à la création et à la modification. */
export async function validerCiblage(acteur: Acteur, body: Record<string, unknown>, sb: SupabaseClient) {
  const titre = String(body.titre ?? '').trim()
  if (!titre) return { erreur: 'Le titre est obligatoire' }
  const clinique = body.clinique as CliniqueEmploye
  if (!cliniquesPolitiquePossibles(acteur).includes(clinique)) return { erreur: 'Clinique non autorisée' }
  const departements = Array.isArray(body.departements) ? Array.from(new Set(body.departements.map(String))) : []
  if (departements.length) {
    const { data } = await sb.from('departements').select('id').in('id', departements)
    if ((data ?? []).length !== departements.length) return { erreur: 'Département inconnu' }
  }
  return { valeurs: { titre, description: String(body.description ?? '').trim() || null, clinique, departements } }
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
    sb.from('employes').select('id, prenom, nom, email, role, clinique, departement_id, actif').or('actif.is.null,actif.eq.true'),
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
      pourcentage: vises.length ? Math.round((confirmes / vises.length) * 100) : 0,
    }
  }
  return res
}

/** Politiques actives qui s'adressent à cet employé, avec son statut pour la version en vigueur. */
/**
 * Politiques visées pour l'employé.
 * `espace` (CMC / WSSC) : n'afficher que les politiques de cet espace (employé rattaché aux deux cliniques).
 */
export async function politiquesDeLEmploye(sb: SupabaseClient, e: { id: string; clinique: string | null; role?: string | null; departement_id: string | null }, espace?: Clinique | null) {
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
export async function nombrePolitiquesEnAttente(sb: SupabaseClient, e: { id: string; clinique: string | null; role?: string | null; departement_id: string | null }, espace?: Clinique | null) {
  try {
    return (await politiquesDeLEmploye(sb, e, espace)).filter(p => !p.confirme_le).length
  } catch {
    return 0 // table absente (script SQL pas encore exécuté) : ne bloque pas le menu
  }
}
