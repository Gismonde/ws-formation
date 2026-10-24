// Assignation groupée : plusieurs formations ou politiques à la fois, à des employés choisis,
// à un ou plusieurs départements, ou à toute une clinique. Côté serveur.
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  type Acteur, filtrerEmployes, peutVoirEmploye, peutVoirDepartement, peutVoirContenu,
  employeConcerneParClinique, cliniquesAdministrees,
} from '@/lib/permissions'
import { cliniquesDe, type Clinique, type CliniqueEmploye } from '@/lib/cliniques'
import { estVise, estPourToute, peutGererPolitique, type Politique } from '@/lib/politiques'

export type Cible =
  | { type: 'employes'; ids: string[] }
  | { type: 'departements'; ids: string[] }
  | { type: 'clinique'; clinique: Clinique }

export type EmployeCible = { id: string; prenom: string | null; nom: string | null; email: string | null; role: string | null; clinique: string | null; departement_id: string | null; poste?: string | null }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_IDS = 500

/** Lit et valide la cible envoyée par le formulaire. */
export function lireCible(brut: unknown): Cible | null {
  const c = brut as { type?: unknown; ids?: unknown; clinique?: unknown } | null
  if (!c) return null
  if (c.type === 'clinique') return c.clinique === 'CMC' || c.clinique === 'WSSC' ? { type: 'clinique', clinique: c.clinique } : null
  if (c.type !== 'employes' && c.type !== 'departements') return null
  const ids = Array.isArray(c.ids) ? Array.from(new Set(c.ids.filter((x): x is string => typeof x === 'string' && UUID.test(x)))).slice(0, MAX_IDS) : []
  return ids.length ? { type: c.type, ids } : null
}

/** La cible est-elle permise à cet acteur ? (une clinique entière : administrateurs de cette clinique) */
export function ciblePermise(a: Acteur, c: Cible): boolean {
  if (c.type === 'clinique') return (a.role === 'super_admin' || a.role === 'admin') && cliniquesAdministrees(a).includes(c.clinique)
  return true
}

/** Employés actifs visés par la cible, dans le périmètre de l'acteur. */
export async function employesDeLaCible(sb: SupabaseClient, a: Acteur, c: Cible): Promise<{ employes: EmployeCible[]; erreur?: string }> {
  const champs = 'id, prenom, nom, email, role, clinique, departement_id, poste, externe'
  if (c.type === 'employes') {
    const { data } = await sb.from('employes').select(champs + ', actif').in('id', c.ids)
    const lignes = (data ?? []) as unknown as (EmployeCible & { actif: boolean | null })[]
    return { employes: lignes.filter(e => e.actif !== false && (e.id === a.id || peutVoirEmploye(a, e))) }
  }
  if (c.type === 'departements') {
    const { data: depts } = await sb.from('departements').select('id, clinique').in('id', c.ids)
    const permis = (depts ?? []).filter(d => peutVoirDepartement(a, d)).map(d => d.id as string)
    if (permis.length === 0) return { employes: [], erreur: 'Département hors de votre périmètre' }
    const { data } = await filtrerEmployes(sb.from('employes').select(champs).in('departement_id', permis).or('actif.is.null,actif.eq.true'), a)
    return { employes: (data ?? []) as unknown as EmployeCible[] }
  }
  if (!ciblePermise(a, c)) return { employes: [], erreur: 'Clinique hors de votre périmètre' }
  const { data } = await filtrerEmployes(sb.from('employes').select(champs).in('clinique', [c.clinique, 'LES_DEUX']).or('actif.is.null,actif.eq.true'), a)
  return { employes: (data ?? []) as unknown as EmployeCible[] }
}

// ---------------------------------------------------------------------------
// Formations

export type ResultatFormation = { formation_id: string; titre: string; creees: number; deja: number; autre_clinique: number; refusee?: string }

export async function assignerFormations(
  sb: SupabaseClient, a: Acteur, formationIds: string[], employes: EmployeCible[], dateEcheance: string | null,
): Promise<{ resultats: ResultatFormation[]; nouvelles: Map<string, string[]> }> {
  const { data: formations } = await sb.from('formations').select('id, titre, clinique, publiee').in('id', formationIds)
  const { data: existantes } = employes.length
    ? await sb.from('assignations').select('employe_id, formation_id').in('formation_id', formationIds).in('employe_id', employes.map(e => e.id))
    : { data: [] as { employe_id: string; formation_id: string }[] }
  const deja = new Set((existantes ?? []).map(x => `${x.employe_id}:${x.formation_id}`))
  const resultats: ResultatFormation[] = []
  const lignes: Record<string, unknown>[] = []
  const nouvelles = new Map<string, string[]>() // employé → formations nouvellement assignées
  const maintenant = new Date().toISOString()

  for (const id of formationIds) {
    const f = (formations ?? []).find(x => x.id === id)
    if (!f || !peutVoirContenu(a, f.clinique)) {
      resultats.push({ formation_id: id, titre: f?.titre ?? 'Formation introuvable', creees: 0, deja: 0, autre_clinique: 0, refusee: 'Hors de votre périmètre' })
      continue
    }
    // Seules les formations validées et publiées peuvent être assignées
    if (!f.publiee) {
      resultats.push({ formation_id: id, titre: f.titre, creees: 0, deja: 0, autre_clinique: 0, refusee: 'Formation non publiée (validation requise avant publication)' })
      continue
    }
    const r: ResultatFormation = { formation_id: id, titre: f.titre, creees: 0, deja: 0, autre_clinique: 0 }
    for (const e of employes) {
      if (e.id !== a.id && !employeConcerneParClinique(e.clinique ?? (e.role === 'super_admin' ? 'LES_DEUX' : null), f.clinique)) { r.autre_clinique++; continue }
      if (deja.has(`${e.id}:${id}`)) { r.deja++; continue }
      r.creees++
      lignes.push({ employe_id: e.id, formation_id: id, assigne_par: a.id, date_assignation: maintenant, ...(dateEcheance ? { date_echeance: dateEcheance } : {}) })
      nouvelles.set(e.id, [...(nouvelles.get(e.id) ?? []), id])
    }
    resultats.push(r)
  }

  for (let i = 0; i < lignes.length; i += 500) {
    const { error } = await sb.from('assignations').insert(lignes.slice(i, i + 500))
    if (error) throw new Error(error.message)
  }
  return { resultats, nouvelles }
}

// ---------------------------------------------------------------------------
// Politiques

export type ResultatPolitique = { politique_id: string; titre: string; ajoutes: number; deja: number; autre_clinique: number; elargie?: boolean; refusee?: string }

/** Nouveau ciblage d'une politique pour inclure la cible (fonction pure, testée). */
export function nouveauCiblage(
  p: Pick<Politique, 'clinique' | 'departements'> & { employes?: string[] | null },
  c: Cible,
  employes: EmployeCible[],
): { clinique: CliniqueEmploye; departements: string[]; employes: string[]; ajoutes: EmployeCible[]; deja: number; autre_clinique: number; elargie: boolean } {
  const depts = p.departements ?? []
  const emps = p.employes ?? []
  const deja = employes.filter(e => estVise(p, e))
  const pasEncore = employes.filter(e => !estVise(p, e))

  if (c.type === 'clinique') {
    const cl = cliniquesDe(p.clinique)
    const clinique: CliniqueEmploye = cl.includes(c.clinique) ? p.clinique : 'LES_DEUX'
    const elargie = clinique !== p.clinique || !estPourToute(p)
    return { clinique, departements: [], employes: [], ajoutes: pasEncore, deja: deja.length, autre_clinique: 0, elargie }
  }

  // Départements / employés : uniquement dans la clinique de la politique
  const vise = (e: EmployeCible) => estVise({ clinique: p.clinique, departements: [], employes: [], roles: [], postes: [] }, e)
  const horsClinique = pasEncore.filter(e => !vise(e))
  const ajoutes = pasEncore.filter(vise)
  if (ajoutes.length === 0) return { clinique: p.clinique, departements: depts, employes: emps, ajoutes, deja: deja.length, autre_clinique: horsClinique.length, elargie: false }

  if (c.type === 'departements') {
    const nouveaux = c.ids.filter(d => !depts.includes(d))
    return { clinique: p.clinique, departements: [...depts, ...nouveaux], employes: emps, ajoutes, deja: deja.length, autre_clinique: horsClinique.length, elargie: false }
  }
  return { clinique: p.clinique, departements: depts, employes: [...emps, ...ajoutes.map(e => e.id).filter(id => !emps.includes(id))], ajoutes, deja: deja.length, autre_clinique: horsClinique.length, elargie: false }
}

export async function assignerPolitiques(
  sb: SupabaseClient, a: Acteur, politiqueIds: string[], c: Cible, employes: EmployeCible[],
): Promise<{ resultats: ResultatPolitique[]; nouvelles: { politique: Politique; employes: EmployeCible[] }[]; migrationRequise?: boolean }> {
  const { data } = await sb.from('politiques').select('*').in('id', politiqueIds).eq('actif', true)
  const resultats: ResultatPolitique[] = []
  const nouvelles: { politique: Politique; employes: EmployeCible[] }[] = []
  for (const id of politiqueIds) {
    const p = (data ?? []).find(x => x.id === id) as Politique | undefined
    if (!p || !peutGererPolitique(a, p)) {
      resultats.push({ politique_id: id, titre: p?.titre ?? 'Politique introuvable', ajoutes: 0, deja: 0, autre_clinique: 0, refusee: 'Hors de votre périmètre' })
      continue
    }
    const n = nouveauCiblage(p, c, employes)
    if (!peutGererPolitique(a, { clinique: n.clinique })) {
      resultats.push({ politique_id: id, titre: p.titre, ajoutes: 0, deja: n.deja, autre_clinique: 0, refusee: 'Il faudrait l’élargir à une clinique que vous n’administrez pas' })
      continue
    }
    const r: ResultatPolitique = { politique_id: id, titre: p.titre, ajoutes: n.ajoutes.length, deja: n.deja, autre_clinique: n.autre_clinique, elargie: n.elargie }
    if (n.ajoutes.length > 0 || n.elargie) {
      const maj: Record<string, unknown> = { clinique: n.clinique, departements: n.departements, updated_at: new Date().toISOString() }
      const changeEmployes = JSON.stringify(n.employes) !== JSON.stringify(p.employes ?? [])
      if (changeEmployes) maj.employes = n.employes
      const { error } = await sb.from('politiques').update(maj).eq('id', id)
      if (error) {
        if (changeEmployes && (error.code === '42703' || /employes/.test(error.message))) return { resultats, nouvelles, migrationRequise: true }
        throw new Error(error.message)
      }
      if (n.ajoutes.length) nouvelles.push({ politique: { ...p, ...maj } as Politique, employes: n.ajoutes })
    }
    resultats.push(r)
  }
  return { resultats, nouvelles }
}
