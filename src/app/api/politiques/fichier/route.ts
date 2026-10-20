import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getActeur, serviceClient } from '@/lib/permissions'
import { BUCKET_MEDIAS, PREFIXE_MEDIA, REGLES_MEDIAS } from '@/lib/medias'
import { peutPublierPolitiques } from '@/lib/politiques'

const EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/msword': 'doc', 'application/vnd.ms-excel': 'xls', 'application/vnd.ms-powerpoint': 'ppt',
}

/** Autorisation d'envoi direct du document d'une politique vers l'espace privé. */
export async function POST(request: Request) {
  const acteur = await getActeur()
  if (!acteur || !peutPublierPolitiques(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { type, taille } = await request.json() as { type: string; taille: number }
  const regle = REGLES_MEDIAS.fichier
  if (!regle.types.includes(type)) return NextResponse.json({ error: `Format non accepté (${regle.libelle})` }, { status: 400 })
  if (typeof taille !== 'number' || taille <= 0 || taille > regle.tailleMaxMo * 1024 * 1024) {
    return NextResponse.json({ error: `Fichier trop volumineux (${regle.libelle})` }, { status: 400 })
  }
  const chemin = `politiques/${new Date().getFullYear()}/${randomUUID()}.${EXTENSIONS[type] ?? 'bin'}`
  const { data, error } = await serviceClient().storage.from(BUCKET_MEDIAS).createSignedUploadUrl(chemin)
  if (error || !data) return NextResponse.json({ error: 'Envoi impossible : ' + (error?.message ?? 'inconnu') }, { status: 500 })
  return NextResponse.json({ chemin, jeton: data.token, reference: PREFIXE_MEDIA + chemin, bucket: BUCKET_MEDIAS })
}
