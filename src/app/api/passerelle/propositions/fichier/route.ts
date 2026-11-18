// POST { type, taille } : autorise l'envoi direct d'un fichier joint à une proposition pour La Passerelle
// (espace privé, dossier propre à l'employé ; le fichier ne transite pas par le serveur).
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getActeur, serviceClient } from '@/lib/permissions'
import { BUCKET_MEDIAS, PREFIXE_MEDIA } from '@/lib/medias'
import { fichierAccepte, peutProposer, prefixeEmploye, FICHIERS_PROPOSITION } from '@/lib/passerelle-propositions'

export async function POST(req: Request) {
  const acteur = await getActeur()
  if (!peutProposer(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const { type, taille } = await req.json().catch(() => ({})) as { type?: string; taille?: number }
  const refus = fichierAccepte(type, taille)
  if (refus) return NextResponse.json({ error: refus }, { status: 400 })
  const chemin = `${prefixeEmploye(acteur!.id)}${randomUUID()}.${FICHIERS_PROPOSITION.types[type!]}`
  const { data, error } = await serviceClient().storage.from(BUCKET_MEDIAS).createSignedUploadUrl(chemin)
  if (error || !data) return NextResponse.json({ error: 'Envoi impossible : ' + (error?.message ?? 'inconnu') }, { status: 500 })
  return NextResponse.json({ chemin, jeton: data.token, reference: PREFIXE_MEDIA + chemin, bucket: BUCKET_MEDIAS })
}
