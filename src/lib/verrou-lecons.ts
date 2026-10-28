// Parcours dans l'ordre : une leçon (et le module suivant) n'est accessible que lorsque
// toutes les leçons précédentes ont été terminées (« Terminer la leçon »). Fonctions pures, testées.

/** Index de la première leçon non terminée (= dernière leçon accessible) ; -1 si tout est terminé. */
export function premiereNonTerminee(ordre: string[], terminees: Set<string>): number {
  return ordre.findIndex(id => !terminees.has(id))
}

/** La leçon est-elle accessible ? (déjà terminée, ou première leçon non terminée) */
export function leconAccessible(ordre: string[], terminees: Set<string>, id: string): boolean {
  const i = ordre.indexOf(id)
  if (i < 0) return true
  const limite = premiereNonTerminee(ordre, terminees)
  return limite === -1 || i <= limite
}
