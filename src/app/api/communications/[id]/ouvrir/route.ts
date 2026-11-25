// GET [?apercu=1 | ?telecharger=1] : ouvre le fichier d'une affiche / communication (adresse temporaire signée).
import { NextResponse } from 'next/server'
import { getActeur, serviceClient } from '@/lib/permissions'
import { BUCKET_MEDIAS, cheminMedia } from '@/lib/medias'
import { getEspace } from '@/lib/espace'
import { estExterne } from '@/lib/membres-externes'
import { peutGererCommunication, visiblePour } from '@/lib/communications'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acteur = await getActeur()
  if (!acteur) return NextResponse.redirect(new URL('/login', req.url))
  if (estExterne(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const sb = serviceClient()
  const { data: c } = await sb.from('communications').select('*').eq('id', id).maybeSingle()
  if (!c) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const espace = await getEspace(acteur)
  if (!visiblePour(c, espace.cliniquesContenu as string[], acteur) && !peutGererCommunication(acteur, c.clinique)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const q = new URL(req.url).searchParams
  const ref = q.get('apercu') === '1' && c.apercu ? c.apercu : c.fichier
  const ext = String(c.fichier).split('.').pop()
  const nom = `${String(c.titre).replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 120) || 'document'}.${ext}`
  const { data: s, error } = await sb.storage.from(BUCKET_MEDIAS).createSignedUrl(cheminMedia(ref), 60 * 30, q.get('telecharger') === '1' ? { download: nom } : undefined)
  if (error || !s?.signedUrl) return NextResponse.json({ error: 'Fichier indisponible' }, { status: 500 })
  return NextResponse.redirect(s.signedUrl)
}
