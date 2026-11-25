// PATCH { nom } : renommer une catégorie. DELETE : la retirer (les documents restent, « sans catégorie »).
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, ipEtAgent } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { estAdminCommunications, lireNomTheme } from '@/lib/communications'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const acteur = await getActeur()
  if (!estAdminCommunications(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const lu = lireNomTheme((await req.json().catch(() => ({})))?.nom)
  if ('erreur' in lu) return NextResponse.json({ error: lu.erreur }, { status: 400 })
  const sb = serviceClient()
  const { data: avant } = await sb.from('themes_documents').select('nom').eq('id', (await params).id).maybeSingle()
  if (!avant) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const { data, error } = await sb.from('themes_documents').update({ nom: lu.nom }).eq('id', (await params).id).select('id, nom').single()
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'Cette catégorie existe déjà.' : error.message }, { status: 400 })
  await logAudit({ acteur_id: acteur!.id, type_action: 'PARAMETRE_MODIFIE', description: `Catégorie de documents « ${avant.nom} » renommée « ${data.nom} »`, ...ipEtAgent(req) })
  return NextResponse.json({ theme: data })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const acteur = await getActeur()
  if (!estAdminCommunications(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const sb = serviceClient()
  const id = (await params).id
  const { data: avant } = await sb.from('themes_documents').select('nom').eq('id', id).maybeSingle()
  if (!avant) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  await sb.from('communications').update({ theme_id: null }).eq('theme_id', id)
  const { error } = await sb.from('themes_documents').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ acteur_id: acteur!.id, type_action: 'PARAMETRE_MODIFIE', description: `Catégorie de documents « ${avant.nom} » retirée (ses documents restent, sans catégorie)`, ...ipEtAgent(req) })
  return NextResponse.json({ ok: true })
}
