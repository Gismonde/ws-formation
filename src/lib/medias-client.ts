'use client'
// Envoi d'un fichier dans l'espace privé des médias (côté navigateur), renvoie sa référence « media:… ».
import { createBrowserClient } from '@supabase/ssr'
import { REGLES_MEDIAS, type GenreMedia } from '@/lib/medias'

const supabaseNavigateur = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function envoyerMedia(fichier: File, genre: GenreMedia): Promise<string> {
  const regle = REGLES_MEDIAS[genre]
  if (!regle.types.includes(fichier.type)) throw new Error(`Format non accepté (${regle.libelle})`)
  if (fichier.size > regle.tailleMaxMo * 1024 * 1024) throw new Error(`Fichier trop volumineux (${regle.libelle})`)
  const res = await fetch('/api/formations/medias', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ genre, type: fichier.type, taille: fichier.size }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Envoi refusé')
  const { error } = await supabaseNavigateur().storage.from(data.bucket).uploadToSignedUrl(data.chemin, data.jeton, fichier, {
    contentType: fichier.type,
  })
  if (error) throw new Error('Envoi échoué : ' + error.message)
  return data.reference as string
}
