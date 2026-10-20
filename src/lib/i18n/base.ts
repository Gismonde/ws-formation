// Traduction de l'interface (français par défaut, anglais en option). Utilisable côté serveur et client.
// Les clés sont les textes français eux-mêmes : t('Mes formations') → « My trainings » en anglais.
// Variables : t('Bonjour {prenom} !', { prenom }) ; une clé absente du dictionnaire reste en français.
import { EN } from './en'

export type Langue = 'fr' | 'en'
export const LANGUES: Langue[] = ['fr', 'en']
export const LANGUE_COOKIE = 'ws_langue'

export function estLangue(v: unknown): v is Langue {
  return v === 'fr' || v === 'en'
}

export type Variables = Record<string, string | number>
export type Traducteur = (texte: string, variables?: Variables) => string

function remplacer(texte: string, variables?: Variables): string {
  if (!variables) return texte
  return texte.replace(/\{(\w+)\}/g, (m, nom) => (nom in variables ? String(variables[nom]) : m))
}

export function traducteur(langue: Langue): Traducteur {
  return (texte, variables) => remplacer(langue === 'en' ? (EN[texte] ?? texte) : texte, variables)
}

/** Paramètres régionaux pour dates et nombres (toLocaleDateString…). */
export function locale(langue: Langue): string {
  return langue === 'en' ? 'en-CA' : 'fr-CA'
}

/** Pluriel simple : 0 ou 1 → singulier en français ; 1 → singulier en anglais. */
export function pluriel(langue: Langue, n: number): boolean {
  return langue === 'en' ? n !== 1 : n > 1
}
