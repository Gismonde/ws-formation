// DELETE : annuler un courriel d'information programmé (pas encore parti).
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, ipEtAgent } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { peutEnvoyerInformation } from '@/lib/courriels-information'

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acteur = await getActeur()
  if (!peutEnvoyerInformation(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const sb = serviceClient()
  const { data } = await sb.from('courriels_information').update({ statut: 'annule' }).eq('id', id).eq('statut', 'programme').select('objet').maybeSingle()
  if (!data) return NextResponse.json({ error: 'Ce courriel n’est plus programmé (déjà parti ou annulé).' }, { status: 409 })
  await logAudit({ acteur_id: acteur!.id, type_action: 'PARAMETRE_MODIFIE', description: `Courriel d’information « ${data.objet} » annulé`, metadata: { courriel_information_id: id }, ...ipEtAgent(req) })
  return NextResponse.json({ ok: true })
}
