// PATCH : modifier / publier (courriel facultatif à la publication) ; DELETE : retirer une affiche / communication.
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, ipEtAgent } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { lireCommunication, peutGererCommunication, CATEGORIES, categorieDe } from '@/lib/communications'
import { prevenirEmployes } from '@/lib/communications-courriel'

async function charger(id: string) {
  const sb = serviceClient()
  const { data } = await sb.from('communications').select('*').eq('id', id).maybeSingle()
  return { sb, c: data }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acteur = await getActeur()
  const { sb, c: avant } = await charger(id)
  if (!avant) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  if (!peutGererCommunication(acteur, avant.clinique)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const corps = await req.json().catch(() => ({})) as Record<string, unknown>
  const lu = lireCommunication({ ...avant, ...corps })
  if ('erreur' in lu) return NextResponse.json({ error: lu.erreur }, { status: 400 })
  if (!peutGererCommunication(acteur, lu.valeurs.clinique)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const publie = typeof corps.publie === 'boolean' ? corps.publie : avant.publie
  const nouvellePublication = publie && !avant.publie
  const { data, error } = await sb.from('communications').update({
    ...lu.valeurs, publie, publie_le: nouvellePublication ? new Date().toISOString() : publie ? avant.publie_le : null, modifie_le: new Date().toISOString(),
  }).eq('id', id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ acteur_id: acteur!.id, type_action: 'PARAMETRE_MODIFIE', description: `${CATEGORIES[categorieDe(data.categorie)].un} « ${data.titre} » ${nouvellePublication ? 'publiée' : !publie && avant.publie ? 'retirée de la publication' : 'modifiée'}`, clinique: data.clinique === 'LES_DEUX' ? null : data.clinique, ...ipEtAgent(req) })
  const courriels = nouvellePublication && corps.prevenir === true ? await prevenirEmployes(sb, data, req) : null
  return NextResponse.json({ communication: data, courriels })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acteur = await getActeur()
  const { sb, c } = await charger(id)
  if (!c) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  if (!peutGererCommunication(acteur, c.clinique)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const { error } = await sb.from('communications').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ acteur_id: acteur!.id, type_action: 'PARAMETRE_MODIFIE', description: `${CATEGORIES[categorieDe(c.categorie)].un} « ${c.titre} » supprimée`, clinique: c.clinique === 'LES_DEUX' ? null : c.clinique, ...ipEtAgent(req) })
  return NextResponse.json({ ok: true })
}
