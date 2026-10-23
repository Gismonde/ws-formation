// Validation des formations avant publication.
//   brouillon → (envoyer en validation) → en_validation → approuvee ou a_modifier
//   Toute modification du contenu ou des réglages remet une formation approuvée en brouillon.
//   Publication (initiale ou nouvelle version) et assignation : seulement une formation approuvée / publiée.
import type { SupabaseClient } from '@supabase/supabase-js'
import { serviceClient, peutValiderFormations, type Acteur } from '@/lib/permissions'
import { cliniquesDe } from '@/lib/cliniques'

export type StatutValidation = 'brouillon' | 'en_validation' | 'a_modifier' | 'approuvee'

export const LIBELLE_STATUT: Record<StatutValidation, string> = {
  brouillon: 'Brouillon — à envoyer en validation',
  en_validation: 'En attente de validation',
  a_modifier: 'Modifications demandées',
  approuvee: 'Approuvée — prête à publier',
}

export type FormationValidation = {
  id: string
  titre: string
  clinique: string | null
  publiee: boolean
  creee_par?: string | null
  statut_validation?: StatutValidation | null
  validateur_id?: string | null
  validation_demandee_par?: string | null
  validation_demandee_le?: string | null
  validation_le?: string | null
  validation_commentaire?: string | null
  validee_par?: string | null
  /** Copie de travail d'une formation publiée */
  copie_de?: string | null
}

export function statutDe(f: Pick<FormationValidation, 'statut_validation'>): StatutValidation {
  return (f.statut_validation ?? 'brouillon') as StatutValidation
}

/** La validation est-elle activée (migration exécutée) ? */
export function validationActive(f: object): boolean {
  return 'statut_validation' in f
}

/** Publication par cet acteur : les administrateurs publient sans validation ; les autres, une fois approuvée. */
export function publicationPermise(a: { role: string } | null, f: FormationValidation): boolean {
  return (!!a && (a.role === 'super_admin' || a.role === 'admin')) || peutEtrePubliee(f)
}

/** Peut-on publier (première publication ou nouvelle version) ? */
export function peutEtrePubliee(f: FormationValidation): boolean {
  return !validationActive(f) || statutDe(f) === 'approuvee'
}

type Validateur = { id: string; role: string; clinique: string | null; peut_valider_formations?: boolean | null; actif?: boolean | null }

/** Cette personne peut-elle valider cette formation ? (jamais la personne qui l'a créée ou qui demande la validation) */
export function estValidateurPossible(v: Validateur, f: Pick<FormationValidation, 'clinique' | 'creee_par'>, demandeurId?: string | null): boolean {
  if (v.actif === false) return false
  if (v.id === f.creee_par || (demandeurId && v.id === demandeurId)) return false
  if (!peutValiderFormations({ role: v.role as Acteur['role'], peut_valider_formations: v.peut_valider_formations === true })) return false
  if (v.role === 'super_admin') return true
  // Admin ou gestionnaire : la formation doit concerner sa clinique
  const sesCliniques = cliniquesDe(v.clinique)
  return cliniquesDe(f.clinique ?? 'LES_DEUX').some(c => sesCliniques.includes(c))
}

/** Validateurs possibles pour une formation. */
export async function validateursPossibles(sb: SupabaseClient, f: Pick<FormationValidation, 'clinique' | 'creee_par'>, demandeurId: string) {
  const { data } = await sb.from('employes').select('*').in('role', ['super_admin', 'admin', 'gestionnaire']).order('nom')
  return ((data ?? []) as (Validateur & { prenom: string | null; nom: string | null; email: string | null })[])
    .filter(v => estValidateurPossible(v, f, demandeurId))
    .map(v => ({ id: v.id, nom: `${v.prenom ?? ''} ${v.nom ?? ''}`.trim() || (v.email ?? ''), email: v.email, role: v.role }))
}

/** Une modification remet une formation approuvée en brouillon (l'approbation portait sur l'ancien contenu). */
export async function invaliderApprobation(formationId: string): Promise<boolean> {
  const sb = serviceClient()
  const { data } = await sb.from('formations').update({ statut_validation: 'brouillon' })
    .eq('id', formationId).eq('statut_validation', 'approuvee').select('id')
  return (data ?? []).length > 0
}
