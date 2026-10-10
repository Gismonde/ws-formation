// Fonctions serveur pour les médias privés (adresses temporaires signées).
import { serviceClient } from '@/lib/permissions'
import { BUCKET_MEDIAS, cheminMedia, estMediaPrive } from '@/lib/medias'

const DUREE_SIGNATURE_SECONDES = 60 * 60 * 3 // 3 h : le temps de suivre une leçon

/** Remplace chaque « media:<chemin> » par une adresse temporaire signée. */
export async function signerUrlsMedias(urls: (string | null | undefined)[]): Promise<Record<string, string>> {
  const chemins = Array.from(new Set(urls.filter(estMediaPrive).map(cheminMedia)))
  if (chemins.length === 0) return {}
  const { data } = await serviceClient().storage.from(BUCKET_MEDIAS).createSignedUrls(chemins, DUREE_SIGNATURE_SECONDES)
  const resultat: Record<string, string> = {}
  for (const d of data ?? []) {
    if (d.path && d.signedUrl) resultat['media:' + d.path] = d.signedUrl
  }
  return resultat
}
