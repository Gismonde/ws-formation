// Qui peut modifier une formation existante ?
//   Administrateurs (global, clinique) : toutes les formations de leurs cliniques.
//   Gestionnaires autorisés à créer : seulement les formations qu'ils ont créées eux-mêmes.
//   Gestionnaire validateur : la formation qu'on lui a envoyée en validation, tant qu'elle est en validation.
import { serviceClient, peutCreerFormations, peutGererContenu, peutValiderFormations, type Acteur } from '@/lib/permissions'
import { cliniquesDe, type Clinique } from '@/lib/cliniques'
import { formationDuModule, formationDeLaLecon, formationDuBloc } from '@/lib/historique-formation'

export const REFUS_MODIFICATION = 'Les gestionnaires ne peuvent modifier que les formations qu’ils ont créées.'

/** Règle (fonction pure, testée) */
export function peutModifierFormation(
  a: Pick<Acteur, 'id' | 'role' | 'peut_creer_formations' | 'clinique' | 'vue'> & { peut_valider_formations?: boolean | null } | null,
  f: { clinique: string | null; creee_par?: string | null; validateur_id?: string | null; statut_validation?: string | null },
): boolean {
  if (!a) return false
  // Le validateur désigné corrige lui-même la formation pendant qu'elle est en validation (dans sa clinique)
  if (estValidateurEnCours(a, f) && dansSaClinique(a, f.clinique)) return true
  if (!peutCreerFormations(a as Acteur) || !peutGererContenu(a as Acteur, f.clinique)) return false
  if (a.role === 'gestionnaire') return !!f.creee_par && f.creee_par === a.id
  return true
}

const dansSaClinique = (a: { role: string; clinique?: string | null }, c: string | null) =>
  a.role === 'super_admin' || !c || c === 'LES_DEUX' || cliniquesDe(a.clinique ?? null).includes(c as Clinique)

/** Gestionnaire (ou admin) désigné comme validateur d'une formation actuellement en validation. */
export function estValidateurEnCours(a: { id: string; role: string; peut_valider_formations?: boolean | null } | null, f: { validateur_id?: string | null; statut_validation?: string | null }): boolean {
  return !!a && !!f.validateur_id && f.validateur_id === a.id && f.statut_validation === 'en_validation' && peutValiderFormations(a as Acteur)
}

/** Message d'erreur si l'acteur ne peut pas modifier cette formation, sinon null. */
export async function refusModification(a: Acteur, formationId: string | null | undefined): Promise<string | null> {
  if (!formationId) return 'Formation introuvable'
  const { data: f } = await serviceClient().from('formations').select('clinique, creee_par, validateur_id, statut_validation').eq('id', formationId).maybeSingle()
  if (!f) return 'Formation introuvable'
  if (peutModifierFormation(a, f as { clinique: string | null; creee_par: string | null; validateur_id: string | null; statut_validation: string | null })) return null
  return a.role === 'gestionnaire' ? REFUS_MODIFICATION : 'Formation hors de votre périmètre'
}

export const refusPourModule = async (a: Acteur, moduleId: string) => refusModification(a, (await formationDuModule(moduleId))?.formationId)
export const refusPourLecon = async (a: Acteur, leconId: string) => refusModification(a, (await formationDeLaLecon(leconId))?.formationId)
export const refusPourBloc = async (a: Acteur, blocId: string) => refusModification(a, (await formationDuBloc(blocId))?.formationId)

/**
 * Client d'écriture : celui de l'utilisateur (règles de la base), sauf pour un validateur qui n'est pas créateur :
 * la base ne lui donne pas le droit d'écrire ; ses droits sur CETTE formation ont été vérifiés juste avant
 * (refusModification), on écrit donc avec le client serveur.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function clientEcriture<T>(a: Acteur, utilisateur: T): T { return (peutCreerFormations(a) ? utilisateur : serviceClient()) as any }
