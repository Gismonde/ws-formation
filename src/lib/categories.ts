// Catégories de formation proposées par défaut. Toute autre catégorie saisie est acceptée
// (« nouvelle catégorie ») et proposée ensuite parmi les catégories existantes.
export const CATEGORIES_FORMATION = [
  'Administration médicale',
  'Communication',
  'Confidentialité & Loi 25',
  'Formation continue',
  'Formation du personnel',
  'Gestion des risques',
  'Gestion des soins',
  'Hygiène et sécurité',
  'Informatique et systèmes',
  'Qualité et conformité',
  'Ressources humaines',
]

/** Nettoie une catégorie saisie (vide → null, 80 caractères max). */
export function nettoyerCategorie(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().replace(/\s+/g, ' ').slice(0, 80) : null
}
