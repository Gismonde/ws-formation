// Au démarrage du serveur : fuseau horaire des cliniques pour tous les calculs de date (affichage, jours du calendrier).
import { FUSEAU } from '@/lib/fuseau'

export function register() {
  if (process.env.NEXT_RUNTIME !== 'edge') process.env.TZ = FUSEAU
}
