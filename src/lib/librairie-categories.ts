// Catégories de la librairie : arbre à deux niveaux (catégorie > sous-catégorie), ordre choisi par l'admin.
// Fonctions pures (testées).
export type CategorieLibrairie = { id: string; nom: string; parent_id: string | null; ordre: number }
export type LigneArbre = CategorieLibrairie & { niveau: 0 | 1; enfants: number }

const parOrdre = (a: CategorieLibrairie, b: CategorieLibrairie) => a.ordre - b.ordre || a.nom.localeCompare(b.nom, 'fr')

/** Liste à plat dans l'ordre d'affichage : chaque catégorie suivie de ses sous-catégories. */
export function arbreCategories(liste: CategorieLibrairie[]): LigneArbre[] {
  const ids = new Set(liste.map(c => c.id))
  const racines = liste.filter(c => !c.parent_id || !ids.has(c.parent_id)).sort(parOrdre)
  const res: LigneArbre[] = []
  for (const r of racines) {
    const enfants = liste.filter(c => c.parent_id === r.id).sort(parOrdre)
    res.push({ ...r, parent_id: null, niveau: 0, enfants: enfants.length })
    for (const e of enfants) res.push({ ...e, niveau: 1, enfants: 0 })
  }
  return res
}

/** Noms couverts par un filtre : la catégorie et ses sous-catégories. */
export function nomsDuFiltre(liste: CategorieLibrairie[], nom: string): string[] {
  const c = liste.find(x => x.nom === nom)
  if (!c) return [nom]
  return [c.nom, ...liste.filter(x => x.parent_id === c.id).map(x => x.nom)]
}

/** Nouvel ordre des frères après déplacement d'un cran vers le haut ou le bas. */
export function deplacer(liste: CategorieLibrairie[], id: string, sens: -1 | 1): { id: string; ordre: number }[] {
  const c = liste.find(x => x.id === id)
  if (!c) return []
  const freres = liste.filter(x => (x.parent_id ?? null) === (c.parent_id ?? null)).sort(parOrdre)
  const i = freres.findIndex(x => x.id === id)
  const j = i + sens
  if (j < 0 || j >= freres.length) return []
  ;[freres[i], freres[j]] = [freres[j], freres[i]]
  return freres.map((x, n) => ({ id: x.id, ordre: n + 1 }))
}

export function nomValide(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.replace(/\s+/g, ' ').trim().slice(0, 80)
  return s || null
}
