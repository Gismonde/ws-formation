// Blocs interactifs d'une leçon (type « interactif », données dans metadata) : définitions et validation.
export type GenreInteractif =
  | 'cartes' | 'accordeon' | 'etapes' | 'chronologie' | 'avant_apres' | 'animation'
  | 'zones' | 'erreurs' | 'scenario' | 'glisser'

export type Carte = { recto: string; verso: string }
export type Section = { titre: string; texte: string }
export type Etape = { titre: string; texte: string; image?: string | null }
export type Jalon = { date: string; titre: string; texte: string }
/** Zone d'une image, en pourcentage de la largeur / hauteur (0–100) */
export type Zone = { id: string; x: number; y: number; l: number; h: number; titre: string; texte: string }
export type ChoixScenario = { texte: string; consequence: string; bon: boolean; suite: string | null }
export type EtapeScenario = { id: string; situation: string; image?: string | null; choix: ChoixScenario[] }
export type Paire = { element: string; categorie: string }

export type DonneesInteractif = {
  genre: GenreInteractif
  cartes?: Carte[]
  sections?: Section[]
  mode?: 'accordeon' | 'onglets'
  etapes?: Etape[]
  jalons?: Jalon[]
  avant?: string | null
  apres?: string | null
  legende_avant?: string
  legende_apres?: string
  animation?: string | null
  boucle?: boolean
  image?: string | null
  zones?: Zone[]
  scenario?: EtapeScenario[]
  /** glisser : « associer » (éléments → catégories) ou « ordonner » (remettre dans l'ordre) */
  variante?: 'associer' | 'ordonner'
  paires?: Paire[]
  ordre?: string[]
  /** L'exercice doit être réussi pour terminer la leçon */
  obligatoire?: boolean
  consigne?: string
}

export const GENRES: { genre: GenreInteractif; icone: string; libelle: string; aide: string; famille: 'anime' | 'exercice' }[] = [
  { genre: 'cartes', icone: '🃏', libelle: 'Cartes à retourner', aide: 'Recto : question ou terme, verso : réponse', famille: 'anime' },
  { genre: 'accordeon', icone: '📑', libelle: 'Accordéon / onglets', aide: 'Contenus longs repliés', famille: 'anime' },
  { genre: 'etapes', icone: '👣', libelle: 'Étapes guidées', aide: 'Une procédure, étape par étape', famille: 'anime' },
  { genre: 'chronologie', icone: '🕒', libelle: 'Ligne du temps', aide: 'Dates et événements', famille: 'anime' },
  { genre: 'avant_apres', icone: '↔️', libelle: 'Avant / après', aide: 'Curseur entre deux images', famille: 'anime' },
  { genre: 'animation', icone: '✨', libelle: 'Animation', aide: 'Animation Lottie (LottieFiles)', famille: 'anime' },
  { genre: 'zones', icone: '🎯', libelle: 'Image à zones cliquables', aide: 'Cliquer sur une zone affiche une explication', famille: 'exercice' },
  { genre: 'erreurs', icone: '🔍', libelle: 'Trouvez l’erreur', aide: 'Photo avec des erreurs cachées à trouver', famille: 'exercice' },
  { genre: 'scenario', icone: '🧭', libelle: 'Mise en situation', aide: 'Une situation, des choix, des conséquences', famille: 'exercice' },
  { genre: 'glisser', icone: '🧩', libelle: 'Glisser-déposer', aide: 'Associer ou remettre dans l’ordre', famille: 'exercice' },
]

/** Contenu de départ d'un nouveau bloc. */
export function donneesInitiales(genre: GenreInteractif): DonneesInteractif {
  switch (genre) {
    case 'cartes': return { genre, cartes: [{ recto: '', verso: '' }, { recto: '', verso: '' }] }
    case 'accordeon': return { genre, mode: 'accordeon', sections: [{ titre: '', texte: '' }, { titre: '', texte: '' }] }
    case 'etapes': return { genre, etapes: [{ titre: '', texte: '' }, { titre: '', texte: '' }] }
    case 'chronologie': return { genre, jalons: [{ date: '', titre: '', texte: '' }, { date: '', titre: '', texte: '' }] }
    case 'avant_apres': return { genre, avant: null, apres: null, legende_avant: 'Avant', legende_apres: 'Après' }
    case 'animation': return { genre, animation: null, boucle: true }
    case 'zones': return { genre, image: null, zones: [], consigne: 'Cliquez sur les zones de l’image pour en savoir plus.' }
    case 'erreurs': return { genre, image: null, zones: [], consigne: 'Trouvez toutes les erreurs dans cette image.', obligatoire: false }
    case 'scenario': return { genre, scenario: [{ id: crypto.randomUUID(), situation: '', choix: [{ texte: '', consequence: '', bon: true, suite: null }, { texte: '', consequence: '', bon: false, suite: null }] }] }
    case 'glisser': return { genre, variante: 'associer', paires: [{ element: '', categorie: '' }, { element: '', categorie: '' }], ordre: ['', '', ''], consigne: '' }
  }
}

/** Références de médias privés (« media:… ») contenues dans les données, pour signer leurs adresses. */
export function refsMedias(valeur: unknown, acc: string[] = []): string[] {
  if (typeof valeur === 'string') { if (valeur.startsWith('media:')) acc.push(valeur) }
  else if (Array.isArray(valeur)) valeur.forEach(v => refsMedias(v, acc))
  else if (valeur && typeof valeur === 'object') Object.values(valeur).forEach(v => refsMedias(v, acc))
  return acc
}

const plein = (s: unknown) => typeof s === 'string' && s.trim().length > 0

/** Le bloc a-t-il assez de contenu pour être montré aux employés ? */
export function estComplet(d: DonneesInteractif | null | undefined): boolean {
  if (!d) return false
  switch (d.genre) {
    case 'cartes': return (d.cartes ?? []).some(c => plein(c.recto) && plein(c.verso))
    case 'accordeon': return (d.sections ?? []).some(s => plein(s.titre))
    case 'etapes': return (d.etapes ?? []).some(e => plein(e.titre) || plein(e.texte))
    case 'chronologie': return (d.jalons ?? []).some(j => plein(j.titre))
    case 'avant_apres': return plein(d.avant) && plein(d.apres)
    case 'animation': return plein(d.animation)
    case 'zones': case 'erreurs': return plein(d.image) && (d.zones ?? []).length > 0
    case 'scenario': return (d.scenario ?? []).some(e => plein(e.situation) && e.choix.filter(c => plein(c.texte)).length >= 2)
    case 'glisser': return d.variante === 'ordonner' ? (d.ordre ?? []).filter(plein).length >= 2 : (d.paires ?? []).filter(p => plein(p.element) && plein(p.categorie)).length >= 2
    default: return false
  }
}

/** Score d'un « trouvez l'erreur » : erreurs trouvées et clics à côté. */
export function scoreErreurs(trouvees: number, total: number, clicsRates: number): number {
  if (!total) return 100
  return Math.max(0, Math.round((trouvees / total) * 100 - clicsRates * 5))
}

/** Le clic (en %) tombe-t-il dans la zone ? */
export function dansZone(z: Pick<Zone, 'x' | 'y' | 'l' | 'h'>, x: number, y: number): boolean {
  return x >= z.x && x <= z.x + z.l && y >= z.y && y <= z.y + z.h
}
