// « Mode employé » : l'équipe parcourt une formation exactement comme un employé, sans rien enregistrer.
// Activé par un cookie (formation en cours d'aperçu) ; la progression simulée est gardée dans un second cookie.
import { cookies } from 'next/headers'
import { getActeur, peutVoirContenu } from '@/lib/permissions'
import { aAccesAdmin } from '@/lib/cliniques'

export const COOKIE_APERCU = 'ws_apercu'
export const COOKIE_PROGRESSION = 'ws_apercu_prog'
export const DUREE_APERCU_S = 4 * 3600

/** Leçons terminées pendant l'aperçu (liste d'identifiants). */
export function lireProgression(valeur: string | undefined): string[] {
  if (!valeur) return []
  return valeur.split('.').filter(x => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 150)
}

export function ecrireProgression(ids: string[]): string {
  return Array.from(new Set(ids)).slice(0, 150).join('.')
}

/** Le mode employé est-il actif pour cette formation (et permis à la personne connectée) ? */
export async function modeApercu(formation: { id: string; clinique: string | null }): Promise<{ actif: boolean; lecons: Set<string> }> {
  const c = await cookies()
  if (c.get(COOKIE_APERCU)?.value !== formation.id) return { actif: false, lecons: new Set() }
  const a = await getActeur()
  if (!a || !aAccesAdmin(a) || !peutVoirContenu(a, formation.clinique)) return { actif: false, lecons: new Set() }
  return { actif: true, lecons: new Set(lireProgression(c.get(COOKIE_PROGRESSION)?.value)) }
}
