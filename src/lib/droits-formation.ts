// Qui peut modifier une formation existante ?
//   Administrateurs (global, clinique) : toutes les formations de leurs cliniques.
//   Gestionnaires autorisés à créer : seulement les formations qu'ils ont créées eux-mêmes.
import { serviceClient, peutCreerFormations, peutGererContenu, type Acteur } from '@/lib/permissions'
import { formationDuModule, formationDeLaLecon, formationDuBloc } from '@/lib/historique-formation'

export const REFUS_MODIFICATION = 'Les gestionnaires ne peuvent modifier que les formations qu’ils ont créées.'

/** Règle (fonction pure, testée) */
export function peutModifierFormation(a: Pick<Acteur, 'id' | 'role' | 'peut_creer_formations' | 'clinique' | 'vue'> | null, f: { clinique: string | null; creee_par?: string | null }): boolean {
  if (!a || !peutCreerFormations(a as Acteur) || !peutGererContenu(a as Acteur, f.clinique)) return false
  if (a.role === 'gestionnaire') return !!f.creee_par && f.creee_par === a.id
  return true
}

/** Message d'erreur si l'acteur ne peut pas modifier cette formation, sinon null. */
export async function refusModification(a: Acteur, formationId: string | null | undefined): Promise<string | null> {
  if (!formationId) return 'Formation introuvable'
  const { data: f } = await serviceClient().from('formations').select('clinique, creee_par').eq('id', formationId).maybeSingle()
  if (!f) return 'Formation introuvable'
  if (peutModifierFormation(a, f as { clinique: string | null; creee_par: string | null })) return null
  return a.role === 'gestionnaire' ? REFUS_MODIFICATION : 'Formation hors de votre périmètre'
}

export const refusPourModule = async (a: Acteur, moduleId: string) => refusModification(a, (await formationDuModule(moduleId))?.formationId)
export const refusPourLecon = async (a: Acteur, leconId: string) => refusModification(a, (await formationDeLaLecon(leconId))?.formationId)
export const refusPourBloc = async (a: Acteur, blocId: string) => refusModification(a, (await formationDuBloc(blocId))?.formationId)
