// Types d'événements et places illimitées (utilisable côté client).
// Trois types de base + les types créés par les admins (table evenements_types_perso).
export type ModeEvenement = 'inscription' | 'participation'
export type InfoType = { id: string; libelle: string; court: string; emoji: string; couleur: string; fond: string; mode: ModeEvenement; fondDefaut: string; perso?: boolean }
export type TypePerso = { id: string; nom: string; emoji: string; couleur: string; fond: string | null; mode: ModeEvenement }

export const TYPES_EVENEMENT: readonly InfoType[] = [
  { id: 'formation', libelle: 'Formation en présentiel', court: 'Formation', emoji: '🎓', couleur: '#1d4ed8', fond: 'linear-gradient(135deg,#dbeafe,#93c5fd)', mode: 'inscription', fondDefaut: 'ocean' },
  { id: 'social', libelle: '5 à 7 et activité sociale', court: 'Social', emoji: '🥂', couleur: '#be185d', fond: 'linear-gradient(135deg,#fce7f3,#f9a8d4)', mode: 'participation', fondDefaut: 'soiree' },
  { id: 'clinique', libelle: 'Événement de la clinique', court: 'Clinique', emoji: '🏥', couleur: '#047857', fond: 'linear-gradient(135deg,#d1fae5,#6ee7b7)', mode: 'participation', fondDefaut: 'foret' },
]
export type TypeEvenement = string
export const TYPES_DE_BASE = ['formation', 'social', 'clinique']
/** Couleurs proposées pour un nouveau type */
export const COULEURS_TYPE = ['#1d4ed8', '#be185d', '#047857', '#b45309', '#e11d48', '#7c3aed', '#0d9488', '#0f172a', '#ea580c', '#0284c7']

export function infoTypePerso(tp: TypePerso): InfoType {
  return { id: tp.id, libelle: tp.nom, court: tp.nom, emoji: tp.emoji, couleur: tp.couleur, fond: `linear-gradient(135deg, ${tp.couleur}1f, ${tp.couleur}66)`, mode: tp.mode, fondDefaut: tp.fond ?? 'ocean', perso: true }
}
/** Tous les types : de base + créés par les admins. */
export const tousLesTypes = (persos: TypePerso[] = []): InfoType[] => [...TYPES_EVENEMENT, ...persos.map(infoTypePerso)]

/** Type d'un événement (le type créé par un admin est joint au chargement dans ev.type_perso). */
export const typeEvenement = (ev: { type?: string | null; type_perso?: TypePerso | null }, persos: TypePerso[] = []): InfoType => {
  const tp = ev.type_perso ?? persos.find(p => p.id === ev.type)
  if (tp) return infoTypePerso(tp)
  return TYPES_EVENEMENT.find(x => x.id === ev.type) ?? TYPES_EVENEMENT[0]
}

/** Séance sans limite de places (5 à 7, assemblée…) : on enregistre le maximum. */
export const PLACES_ILLIMITEES = 1000
export const placesIllimitees = (s: { places: number }) => s.places >= PLACES_ILLIMITEES

/** Fonds proposés à l'admin pour la carte et la bannière (l'image, elle, s'affiche dans la page de l'événement). */
export const FONDS_EVENEMENT = [
  { id: 'ocean', nom: 'Océan', carte: 'linear-gradient(135deg,#dbeafe,#93c5fd)', hero: 'radial-gradient(circle at 80% 20%, #93c5fd 0, transparent 40%), linear-gradient(120deg, #1e3a8a, #2563eb 55%, #0ea5e9)' },
  { id: 'soiree', nom: 'Soirée', carte: 'linear-gradient(135deg,#fce7f3,#f9a8d4)', hero: 'radial-gradient(circle at 80% 20%, #f9a8d4 0, transparent 40%), radial-gradient(circle at 15% 85%, #fbbf24 0, transparent 35%), linear-gradient(120deg, #7c3aed, #db2777 55%, #f97316)' },
  { id: 'foret', nom: 'Forêt', carte: 'linear-gradient(135deg,#d1fae5,#6ee7b7)', hero: 'radial-gradient(circle at 80% 20%, #6ee7b7 0, transparent 40%), linear-gradient(120deg, #064e3b, #059669 55%, #14b8a6)' },
  { id: 'soleil', nom: 'Soleil', carte: 'linear-gradient(135deg,#fef3c7,#fcd34d)', hero: 'radial-gradient(circle at 80% 20%, #fde68a 0, transparent 40%), linear-gradient(120deg, #b45309, #f59e0b 55%, #fbbf24)' },
  { id: 'corail', nom: 'Corail', carte: 'linear-gradient(135deg,#ffe4e6,#fda4af)', hero: 'radial-gradient(circle at 80% 20%, #fecdd3 0, transparent 40%), linear-gradient(120deg, #9f1239, #e11d48 55%, #fb7185)' },
  { id: 'lavande', nom: 'Lavande', carte: 'linear-gradient(135deg,#ede9fe,#c4b5fd)', hero: 'radial-gradient(circle at 80% 20%, #c4b5fd 0, transparent 40%), linear-gradient(120deg, #4c1d95, #7c3aed 55%, #a78bfa)' },
  { id: 'nuit', nom: 'Nuit étoilée', carte: 'linear-gradient(135deg,#e0e7ff,#a5b4fc)', hero: 'radial-gradient(circle at 75% 25%, #818cf8 0, transparent 35%), radial-gradient(circle at 20% 80%, #c084fc 0, transparent 30%), linear-gradient(120deg, #0f172a, #1e1b4b 55%, #312e81)' },
  { id: 'menthe', nom: 'Menthe', carte: 'linear-gradient(135deg,#ccfbf1,#5eead4)', hero: 'radial-gradient(circle at 80% 20%, #99f6e4 0, transparent 40%), linear-gradient(120deg, #115e59, #0d9488 55%, #2dd4bf)' },
] as const
export type FondEvenement = (typeof FONDS_EVENEMENT)[number]
/** Fond choisi par l'admin, sinon celui du type. */
export const fondEvenement = (ev: { type?: string | null; fond?: string | null; type_perso?: TypePerso | null }, persos: TypePerso[] = []): FondEvenement =>
  FONDS_EVENEMENT.find(f => f.id === ev.fond) ?? FONDS_EVENEMENT.find(f => f.id === typeEvenement(ev, persos).fondDefaut) ?? FONDS_EVENEMENT[0]

/** Le droit « Mise en page des événements » peut être donné à qui peut créer des événements (admin, ou gestionnaire autorisé). */
export const droitMiseEnPagePossible = (role: string, peutCreerEvenements?: boolean | null) =>
  role === 'admin' || (role === 'gestionnaire' && peutCreerEvenements === true)

/** Emojis proposés pour un événement (l'admin peut aussi en coller un autre). */
export const EMOJIS_EVENEMENT = ['🎓', '🥂', '🏥', '🎉', '🎄', '🎃', '🍕', '🍰', '☕', '🍻', '🏆', '🎂', '🎶', '🏃', '⚽', '🧘', '❤️', '🩺', '💉', '🫀', '🧪', '📢', '🤝', '🌸'] as const
/** Emoji choisi pour l'événement, sinon celui de son type. */
export const emojiEvenement = (ev: { type?: string | null; emoji?: string | null; type_perso?: TypePerso | null }, persos: TypePerso[] = []) => (ev.emoji && ev.emoji.trim()) || typeEvenement(ev, persos).emoji
