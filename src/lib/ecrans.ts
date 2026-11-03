// Mode « présentation » : regroupement des blocs d'une leçon en écrans successifs.
type BlocEcran = { type: string; metadata?: Record<string, unknown> | null }

/**
 * - si des blocs portent metadata.ecran (numéro d'écran, ex. import Coassemble), on regroupe par ce numéro ;
 * - sinon un bloc = un écran, sauf un texte suivi (ou précédé) d'une image : ils partagent l'écran.
 */
export function grouperEcrans<B extends BlocEcran>(blocs: B[]): B[][] {
  if (blocs.some(b => typeof b.metadata?.ecran === 'number')) {
    const groupes: B[][] = []
    let courant: unknown = Symbol()
    for (const b of blocs) {
      const e = typeof b.metadata?.ecran === 'number' ? b.metadata.ecran : Symbol()
      if (e !== courant || groupes.length === 0) { groupes.push([b]); courant = e } else groupes[groupes.length - 1].push(b)
    }
    return groupes
  }
  const groupes: B[][] = []
  for (const b of blocs) {
    const dernier = groupes[groupes.length - 1]
    const paire = dernier && dernier.length === 1 && (
      (dernier[0].type === 'text' && b.type === 'image') || (dernier[0].type === 'image' && b.type === 'text'))
    if (paire) dernier.push(b); else groupes.push([b])
  }
  return groupes
}
