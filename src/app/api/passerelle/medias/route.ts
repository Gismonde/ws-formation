// POST { genre, type, taille } : autorise l'envoi direct du PDF d'une édition (ou de sa couverture) vers l'espace privé.
// Réservé à l'équipe de La Passerelle et à l'administrateur global.
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getActeur, serviceClient } from '@/lib/permissions'
import { BUCKET_MEDIAS, PREFIXE_MEDIA, REGLES_MEDIAS } from '@/lib/medias'
import { gerePasserelle } from '@/lib/passerelle'

const PERMIS: Record<string, string> = { 'application/pdf': 'pdf', 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' }

export async function POST(req: Request) {
  const acteur = await getActeur()
  const sb = serviceClient()
  if (!(await gerePasserelle(sb, acteur))) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const { genre, type, taille } = await req.json().catch(() => ({})) as { genre?: 'fichier' | 'image'; type?: string; taille?: number }
  const regle = genre === 'image' ? REGLES_MEDIAS.image : REGLES_MEDIAS.fichier
  if (!type || !PERMIS[type] || !regle.types.includes(type)) return NextResponse.json({ error: 'Format non accepté (PDF pour l’édition)' }, { status: 400 })
  if (typeof taille !== 'number' || taille <= 0 || taille > regle.tailleMaxMo * 1024 * 1024) return NextResponse.json({ error: `Fichier trop volumineux (${regle.libelle})` }, { status: 400 })
  const m = new Date()
  const chemin = `passerelle/${m.getFullYear()}/${String(m.getMonth() + 1).padStart(2, '0')}/${randomUUID()}.${PERMIS[type]}`
  const { data, error } = await sb.storage.from(BUCKET_MEDIAS).createSignedUploadUrl(chemin)
  if (error || !data) return NextResponse.json({ error: 'Envoi impossible : ' + (error?.message ?? 'inconnu') }, { status: 500 })
  return NextResponse.json({ chemin, jeton: data.token, reference: PREFIXE_MEDIA + chemin, bucket: BUCKET_MEDIAS })
}
