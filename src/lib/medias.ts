// Médias des formations (images, vidéos, fichiers) stockés dans un espace PRIVÉ Supabase.
// Dans un bloc de contenu, un média privé est enregistré sous la forme « media:<chemin> ».
// Il n'est jamais exposé par une adresse publique : on génère une adresse temporaire signée à l'affichage.

export const BUCKET_MEDIAS = 'formation-medias'
export const PREFIXE_MEDIA = 'media:'

export type GenreMedia = 'image' | 'video' | 'fichier'

export const REGLES_MEDIAS: Record<GenreMedia, { types: string[]; tailleMaxMo: number; libelle: string }> = {
  image: {
    types: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    tailleMaxMo: 10,
    libelle: 'JPG, PNG, GIF ou WebP — 10 Mo max',
  },
  video: {
    types: ['video/mp4', 'video/webm', 'video/quicktime'],
    tailleMaxMo: 50,
    libelle: 'MP4, WebM ou MOV — 50 Mo max',
  },
  fichier: {
    types: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/msword',
      'application/vnd.ms-excel',
      'application/vnd.ms-powerpoint',
    ],
    tailleMaxMo: 20,
    libelle: 'PDF, Word, Excel ou PowerPoint — 20 Mo max',
  },
}

export function estMediaPrive(url: string | null | undefined): url is string {
  return !!url && url.startsWith(PREFIXE_MEDIA)
}

export function cheminMedia(url: string): string {
  return url.slice(PREFIXE_MEDIA.length)
}

// ---------------------------------------------------------------------------
// Vidéos en ligne (YouTube, Vimeo)
// ---------------------------------------------------------------------------

export type VideoEnLigne = { plateforme: 'youtube' | 'vimeo'; id: string; embed: string; miniature: string | null }

export function analyserVideoEnLigne(url: string): VideoEnLigne | null {
  const u = url.trim()
  const yt = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/)
  if (yt) {
    return {
      plateforme: 'youtube',
      id: yt[1],
      embed: `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0`,
      miniature: `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg`,
    }
  }
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vm) {
    return { plateforme: 'vimeo', id: vm[1], embed: `https://player.vimeo.com/video/${vm[1]}`, miniature: null }
  }
  return null
}
