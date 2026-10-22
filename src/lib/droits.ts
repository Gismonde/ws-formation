// Droits des gestionnaires dans l'admin (les administrateurs les ont tous, un employé aucun).
export const DROITS_GESTIONNAIRE = [
  { cle: 'peut_suivre_employes', libelle: 'Suivre les employés de son département', aide: 'Liste, progression, conformité, assignations et rappels pour son département.' },
  { cle: 'peut_creer_formations', libelle: 'Créer et modifier des formations', aide: 'Les formations créées doivent être validées par une autre personne avant publication.' },
  { cle: 'peut_valider_formations', libelle: 'Valider des formations', aide: 'Peut être choisi comme validateur des formations créées par d’autres.' },
  { cle: 'peut_creer_evenements', libelle: 'Créer des événements en présentiel', aide: 'Séances de formation avec inscriptions des employés.' },
] as const

export type CleDroit = (typeof DROITS_GESTIONNAIRE)[number]['cle']
export type Droits = Record<CleDroit, boolean>

export const AUCUN_DROIT: Droits = { peut_suivre_employes: false, peut_creer_formations: false, peut_valider_formations: false, peut_creer_evenements: false }

export function droitsDe(e: Partial<Record<CleDroit, boolean | null>> | null | undefined): Droits {
  return {
    peut_suivre_employes: e?.peut_suivre_employes === true,
    peut_creer_formations: e?.peut_creer_formations === true,
    peut_valider_formations: e?.peut_valider_formations === true,
    peut_creer_evenements: e?.peut_creer_evenements === true,
  }
}

/** Droits à enregistrer : seulement pour un gestionnaire (sinon tout à faux). */
export function droitsAEnregistrer(role: string, corps: Record<string, unknown>, actuels?: Droits): Droits {
  if (role !== 'gestionnaire') return { ...AUCUN_DROIT }
  const res = { ...(actuels ?? AUCUN_DROIT) }
  for (const d of DROITS_GESTIONNAIRE) if (typeof corps[d.cle] === 'boolean') res[d.cle] = corps[d.cle] as boolean
  return res
}

/** Description lisible des changements de droits (journal d'audit). */
export function changementsDroits(avant: Droits, apres: Droits): string[] {
  return DROITS_GESTIONNAIRE.filter(d => avant[d.cle] !== apres[d.cle]).map(d => `${apres[d.cle] ? '+' : '−'} ${d.libelle}`)
}
