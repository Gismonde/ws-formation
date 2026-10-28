// « Empêcher d'avancer » : l'employé ne peut pas sauter plus loin que ce qu'il a déjà regardé
// (revenir en arrière reste permis). Fonctions pures, testées.
export const TOLERANCE_AVANCE = 2

/** Nouveau maximum regardé, après une lecture normale jusqu'à `temps`. */
export function maxRegarde(max: number, temps: number): number {
  return temps <= max + TOLERANCE_AVANCE ? Math.max(max, temps) : max
}

/** Position permise : si l'employé saute au-delà de ce qu'il a regardé, on le ramène au maximum regardé. */
export function positionPermise(max: number, temps: number): number | null {
  return temps > max + TOLERANCE_AVANCE ? max : null
}
