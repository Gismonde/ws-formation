// Courriel « Nouvelle affiche / communication » aux employés de la clinique (comptes activés seulement).
import type { SupabaseClient } from '@supabase/supabase-js'
import { envoyerCourriels, courrielsActifs, gabarit, origineDepuis } from '@/lib/courriels'
import { destinatairesCommunication, type Communication } from '@/lib/communications'

export async function prevenirEmployes(sb: SupabaseClient, c: Communication, req: Request): Promise<{ envoyes: number; destinataires: number } | { erreur: string }> {
  if (!courrielsActifs()) return { erreur: 'Envoi de courriels désactivé' }
  const dest = await destinatairesCommunication(sb, c.clinique)
  const origine = origineDepuis(req)
  const courriels = dest.map(e => ({
    a: e.email as string,
    sujet: `Nouvelle communication : ${c.titre}`,
    ...gabarit({
      origine, clinique: c.clinique === 'LES_DEUX' ? ((e.clinique as string | null) ?? null) : c.clinique,
      titre: 'Nouvelle affiche / communication',
      paragraphes: [`Bonjour ${e.prenom ?? ''},`.replace(' ,', ','), `Une nouvelle affiche / communication est disponible dans WS Formation : « ${c.titre} ».`, c.description].filter(Boolean),
      bouton: { libelle: 'La consulter', lien: `${origine}/dashboard/communications` },
    }),
  }))
  const r = await envoyerCourriels(courriels).catch(e => ({ envoyes: 0, erreur: String(e) }))
  return { envoyes: (r as { envoyes: number }).envoyes ?? 0, destinataires: dest.length }
}
