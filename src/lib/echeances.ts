// Paliers de relance pour les formations assignées avec une date d'échéance.

/** Relances avant l'échéance (7 jours, puis la veille ou le jour même) et après (1 jour, puis chaque semaine pendant 4 semaines). */
export type PalierEcheance = 'J-7' | 'J-1' | 'retard-1' | 'retard-7' | 'retard-14' | 'retard-21' | 'retard-28'

/**
 * Palier atteint selon le nombre de jours restants avant l'échéance (négatif = en retard).
 * null : trop tôt, ou retard de plus de 5 semaines (on cesse de relancer l'employé).
 */
export function palierRelanceEcheance(jours: number): PalierEcheance | null {
  if (jours > 7) return null
  if (jours >= 2) return 'J-7'
  if (jours >= 0) return 'J-1'
  const retard = -jours
  if (retard < 7) return 'retard-1'
  if (retard < 14) return 'retard-7'
  if (retard < 21) return 'retard-14'
  if (retard < 28) return 'retard-21'
  if (retard < 35) return 'retard-28'
  return null
}

export function estEnRetard(p: PalierEcheance): boolean {
  return p.startsWith('retard')
}
