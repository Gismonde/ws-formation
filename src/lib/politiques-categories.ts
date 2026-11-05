// Catégories de rangement des politiques (utilisable côté client).
// Une catégorie a un code court (MED, CON, CHU…), un nom et des départements associés :
// ranger une politique dans la catégorie cible automatiquement ces départements.
export type CategoriePolitique = {
  id: string
  code: string
  nom: string
  emoji: string | null
  departements: string[]
  ordre: number
}

export const libelleCategorie = (c: Pick<CategoriePolitique, 'code' | 'nom'>) => `${c.code} — ${c.nom}`

/** Code : 2 à 8 lettres ou chiffres, en majuscules (ex. MED, CON, PRP). */
export const normaliserCode = (v: unknown) => String(v ?? '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]/g, '').slice(0, 8)

/** Regroupe des politiques par catégorie, dans l'ordre des catégories ; « Sans catégorie » à la fin. */
export function parCategorie<P extends { categorie_id?: string | null }>(pols: P[], cats: CategoriePolitique[]): { categorie: CategoriePolitique | null; politiques: P[] }[] {
  const groupes = cats.map(c => ({ categorie: c as CategoriePolitique | null, politiques: pols.filter(p => p.categorie_id === c.id) })).filter(g => g.politiques.length)
  const sans = pols.filter(p => !p.categorie_id || !cats.some(c => c.id === p.categorie_id))
  return sans.length ? [...groupes, { categorie: null, politiques: sans }] : groupes
}

export const EMOJIS_CATEGORIE = ['💊', '🚶', '🔒', '🩺', '🏢', '🧼', '🚨', '📋', '👥', '⚖️', '🧯', '🩸', '🫀', '🧪', '📁', '🛏️'] as const
