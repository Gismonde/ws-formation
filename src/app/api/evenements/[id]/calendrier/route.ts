// Fichier calendrier (.ics) d'une séance, pour Outlook, Google Agenda ou Apple Calendrier.
import { getActeur, serviceClient } from '@/lib/permissions'
import { origineDepuis } from '@/lib/courriels'
import { chargerEvenement, estInvite, fichierIcs } from '@/lib/evenements'
import { peutGererEvenement } from '@/lib/evenements-admin'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acteur = await getActeur()
  if (!acteur) return Response.redirect(new URL(`/login`, req.url), 303)
  const d = await chargerEvenement(serviceClient(), id)
  if (!d || (!estInvite(d.ev, acteur) && !peutGererEvenement(acteur, d.ev))) return new Response('Introuvable', { status: 404 })
  const s = d.seances.find(x => x.id === new URL(req.url).searchParams.get('seance')) ?? d.seances[0]
  if (!s) return new Response('Aucune séance', { status: 404 })
  const contenu = fichierIcs(d.ev, s, `${origineDepuis(req)}/dashboard/evenements/${id}`)
  return new Response(contenu, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `attachment; filename="evenement-${id.slice(0, 8)}.ics"` } })
}
