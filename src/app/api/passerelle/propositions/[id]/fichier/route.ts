// GET ?i=0[&telecharger=1] : ouvre un fichier joint à une proposition (adresse temporaire signée).
// Réservé aux personnes qui reçoivent les propositions, aux administrateurs de La Passerelle et à l'auteur.
import { NextResponse } from 'next/server'
import { getActeur, serviceClient } from '@/lib/permissions'
import { BUCKET_MEDIAS, cheminMedia } from '@/lib/medias'
import { chargerDestinataires, peutVoirPropositions, type FichierProposition } from '@/lib/passerelle-propositions'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acteur = await getActeur()
  if (!acteur) return NextResponse.redirect(new URL('/login', req.url))
  const sb = serviceClient()
  const { data: p } = await sb.from('passerelle_propositions').select('employe_id, fichiers').eq('id', id).maybeSingle()
  if (!p) return NextResponse.json({ error: 'Proposition introuvable' }, { status: 404 })
  if (p.employe_id !== acteur.id && !peutVoirPropositions(acteur, await chargerDestinataires(sb))) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const u = new URL(req.url)
  const f = ((p.fichiers ?? []) as FichierProposition[])[Number(u.searchParams.get('i'))]
  if (!f) return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 })
  const { data: s, error } = await sb.storage.from(BUCKET_MEDIAS).createSignedUrl(cheminMedia(f.ref), 60 * 30, u.searchParams.get('telecharger') === '1' ? { download: f.nom } : undefined)
  if (error || !s?.signedUrl) return NextResponse.json({ error: 'Fichier indisponible' }, { status: 500 })
  return NextResponse.redirect(s.signedUrl)
}
