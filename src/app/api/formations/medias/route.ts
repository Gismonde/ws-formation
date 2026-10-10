import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getCreateurFormations, serviceClient } from '@/lib/permissions'
import { BUCKET_MEDIAS, PREFIXE_MEDIA, REGLES_MEDIAS, GenreMedia } from '@/lib/medias'
import { signerUrlsMedias } from '@/lib/medias-serveur'

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/msword': 'doc', 'application/vnd.ms-excel': 'xls', 'application/vnd.ms-powerpoint': 'ppt',
}

/**
 * Prépare l'envoi d'un média : vérifie les droits, le type et la taille,
 * puis renvoie une autorisation d'envoi direct vers l'espace privé (le fichier ne transite pas par le serveur).
 */
export async function POST(request: Request) {
  const createur = await getCreateurFormations()
  if (!createur) return NextResponse.json({ error: 'Non autorise - creation de formations non permise' }, { status: 403 })

  const { genre, type, taille } = await request.json() as { genre: GenreMedia; type: string; taille: number }
  const regle = REGLES_MEDIAS[genre]
  if (!regle) return NextResponse.json({ error: 'Type de media inconnu' }, { status: 400 })
  if (!regle.types.includes(type)) return NextResponse.json({ error: `Format non accepte (${regle.libelle})` }, { status: 400 })
  if (typeof taille !== 'number' || taille <= 0 || taille > regle.tailleMaxMo * 1024 * 1024) {
    return NextResponse.json({ error: `Fichier trop volumineux (${regle.libelle})` }, { status: 400 })
  }

  const maintenant = new Date()
  const chemin = `${maintenant.getFullYear()}/${String(maintenant.getMonth() + 1).padStart(2, '0')}/${randomUUID()}.${EXTENSIONS[type] ?? 'bin'}`
  const { data, error } = await serviceClient().storage.from(BUCKET_MEDIAS).createSignedUploadUrl(chemin)
  if (error || !data) return NextResponse.json({ error: 'Envoi impossible : ' + (error?.message ?? 'inconnu') }, { status: 500 })

  return NextResponse.json({ chemin, jeton: data.token, reference: PREFIXE_MEDIA + chemin, bucket: BUCKET_MEDIAS })
}

/** Adresses temporaires pour prévisualiser des médias privés dans l'éditeur. */
export async function GET(request: Request) {
  const createur = await getCreateurFormations()
  if (!createur) return NextResponse.json({ error: 'Acces refuse' }, { status: 403 })
  const refs = new URL(request.url).searchParams.getAll('ref')
  return NextResponse.json({ urls: await signerUrlsMedias(refs) })
}
