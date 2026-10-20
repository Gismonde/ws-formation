// Langue de l'interface côté serveur : cookie ws_langue (choix de l'employé), français par défaut.
import { cookies } from 'next/headers'
import { estLangue, locale, traducteur, LANGUE_COOKIE, type Langue, type Traducteur } from './base'

export async function langueCourante(): Promise<Langue> {
  try {
    const v = (await cookies()).get(LANGUE_COOKIE)?.value
    return estLangue(v) ? v : 'fr'
  } catch {
    return 'fr' // hors requête (tâche planifiée)
  }
}

export async function i18n(): Promise<{ langue: Langue; t: Traducteur; loc: string }> {
  const langue = await langueCourante()
  return { langue, t: traducteur(langue), loc: locale(langue) }
}
