// POST { type, taille } : autorise l'envoi direct d'une affiche / communication (ou de sa vignette) vers l'espace privé.
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getActeur, serviceClient } from '@/lib/permissions'
import { BUCKET_MEDIAS, PREFIXE_MEDIA } from '@/lib/medias'
import { estAdminCommunications, TYPES_COMMUNICATION } from '@/lib/communications'

export async function POST(req: Request) {
  const acteur = await getActeur()
  if (!estAdminCommunications(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const { type, taille } = await req.json().catch(() => ({})) as { type?: string; taille?: number }
  if (!type || !TYPES_COMMUNICATION[type]) return NextResponse.json({ error: 'Format non accepté (PDF, JPEG, PNG ou WebP)' }, { status: 400 })
  if (typeof taille !== 'number' || taille <= 0 || taille > 25 * 1024 * 1024) return NextResponse.json({ error: 'Fichier trop volumineux (25 Mo max)' }, { status: 400 })
  const m = new Date()
  const chemin = `communications/${m.getFullYear()}/${String(m.getMonth() + 1).padStart(2, '0')}/${randomUUID()}.${TYPES_COMMUNICATION[type]}`
  const { data, error } = await serviceClient().storage.from(BUCKET_MEDIAS).createSignedUploadUrl(chemin)
  if (error || !data) return NextResponse.json({ error: 'Envoi impossible : ' + (error?.message ?? 'inconnu') }, { status: 500 })
  return NextResponse.json({ chemin, jeton: data.token, reference: PREFIXE_MEDIA + chemin, bucket: BUCKET_MEDIAS })
}
