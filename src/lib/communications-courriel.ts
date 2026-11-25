// Courriel « Nouvelle affiche / communication » aux employés de la clinique (comptes activés seulement).
import type { SupabaseClient } from '@supabase/supabase-js'
import { envoyerCourriels, courrielsActifs, gabarit, origineDepuis } from '@/lib/courriels'
import { destinatairesCommunication, CATEGORIES, categorieDe, type Communication } from '@/lib/communications'

export async function prevenirEmployes(sb: SupabaseClient, c: Communication, req: Request): Promise<{ envoyes: number; destinataires: number } | { erreur: string }> {
  if (!courrielsActifs()) return { erreur: 'Envoi de courriels désactivé' }
  const dest = await destinatairesCommunication(sb, c.clinique)
  const origine = origineDepuis(req)
  const cat = CATEGORIES[categorieDe(c.categorie)]
  const courriels = dest.map(e => ({
    a: e.email as string,
    sujet: `${cat.nouveau} : ${c.titre}`,
    ...gabarit({
      origine, clinique: c.clinique === 'LES_DEUX' ? ((e.clinique as string | null) ?? null) : c.clinique,
      titre: cat.nouveau,
      paragraphes: [`Bonjour ${e.prenom ?? ''},`.replace(' ,', ','), `Nouveau dans WS Formation (${cat.libelle}) : « ${c.titre} ».`, c.description].filter(Boolean),
      bouton: { libelle: 'La consulter', lien: `${origine}${cat.page}` },
    }),
  }))
  const r = await envoyerCourriels(courriels).catch(e => ({ envoyes: 0, erreur: String(e) }))
  return { envoyes: (r as { envoyes: number }).envoyes ?? 0, destinataires: dest.length }
}
