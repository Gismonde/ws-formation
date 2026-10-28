// Pronoms facultatifs, choisis par la personne elle-même (Mon profil). Affichés à côté de son nom.
export const PRONOMS_PROPOSES = ['il/lui', 'elle/elle', 'iel/iel', 'il/elle', 'he/him', 'she/her', 'they/them'] as const

/** Valeur à enregistrer (fonction pure, testée) : texte libre court, espaces nettoyés, vide = null. */
export function normaliserPronoms(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40)
  return s || null
}
