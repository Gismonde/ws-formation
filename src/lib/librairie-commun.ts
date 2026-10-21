// Librairie : types et fonctions communs (navigateur et serveur).
import { analyserVideoEnLigne, estMediaPrive } from '@/lib/medias'
import type { CliniqueContenu } from '@/lib/cliniques'

export type TypeLibrairie = 'video' | 'lien' | 'document'
export const TYPES_LIBRAIRIE: TypeLibrairie[] = ['video', 'lien', 'document']
export const LIBELLE_TYPE_LIBRAIRIE: Record<TypeLibrairie, string> = { video: 'Vidéos', lien: 'Liens', document: 'Documents' }

export type ElementLibrairie = {
  id: string
  type: TypeLibrairie
  titre: string
  description: string | null
  url: string
  nom_fichier: string | null
  categorie: string | null
  clinique: CliniqueContenu
  archive: boolean
  source: string | null
  modifie_le: string
}

export type Utilisation = { bloc_id: string; lecon: string; module: string; formation_id: string; formation: string }

/** Plateforme d'une vidéo (pour l'affichage). */
export function plateformeVideo(url: string): string {
  if (estMediaPrive(url)) return 'Fichier'
  const v = analyserVideoEnLigne(url)
  if (v) return v.plateforme === 'youtube' ? 'YouTube' : 'Vimeo'
  if (/sharepoint\.com|stream/i.test(url)) return 'SharePoint'
  return 'Lien'
}

