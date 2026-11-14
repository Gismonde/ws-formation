// Ouvre (ou télécharge, ?telecharger=1) une édition de La Passerelle : adresse temporaire signée vers le PDF privé.
// La lecture est notée pour le badge « Lecteur de La Passerelle ».
import { NextResponse } from 'next/server'
import { getActeur, serviceClient } from '@/lib/permissions'
import { cliniquesDe } from '@/lib/cliniques'
import { BUCKET_MEDIAS, cheminMedia } from '@/lib/medias'
import { nomFichier, peutGererPasserelle, CLINIQUE_PASSERELLE } from '@/lib/passerelle'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acteur = await getActeur()
  if (!acteur) return NextResponse.redirect(new URL('/login', req.url))
  const admin = peutGererPasserelle(acteur)
  if (!admin && !cliniquesDe(acteur.clinique).includes(CLINIQUE_PASSERELLE)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const sb = serviceClient()
  const { data: e } = await sb.from('passerelle_editions').select('id, numero, date_parution, pdf, publie').eq('id', id).eq('clinique', CLINIQUE_PASSERELLE).maybeSingle()
  if (!e || (!e.publie && !admin)) return NextResponse.json({ error: 'Édition introuvable' }, { status: 404 })
  const telecharger = new URL(req.url).searchParams.get('telecharger') === '1'
  const { data: s, error } = await sb.storage.from(BUCKET_MEDIAS).createSignedUrl(cheminMedia(e.pdf), 60 * 30, telecharger ? { download: nomFichier(e) } : undefined)
  if (error || !s?.signedUrl) return NextResponse.json({ error: 'Fichier indisponible' }, { status: 500 })
  if (e.publie) await sb.from('passerelle_lectures').upsert({ employe_id: acteur.id, edition_id: e.id }, { onConflict: 'employe_id,edition_id', ignoreDuplicates: true })
  return NextResponse.redirect(s.signedUrl)
}
