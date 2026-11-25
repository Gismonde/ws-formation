// PATCH { nom } : renommer une catégorie. DELETE : la retirer (les documents restent, « sans catégorie »).
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, ipEtAgent } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { estAdminCommunications, lireNomTheme, estUuid } from '@/lib/communications'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const acteur = await getActeur()
  if (!estAdminCommunications(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const lu = lireNomTheme((await req.json().catch(() => ({})))?.nom)
  if ('erreur' in lu) return NextResponse.json({ error: lu.erreur }, { status: 400 })
  const sb = serviceClient()
  const { data: avant } = await sb.from('themes_documents').select('nom').eq('id', (await params).id).maybeSingle()
  if (!avant) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const { data, error } = await sb.from('themes_documents').update({ nom: lu.nom }).eq('id', (await params).id).select('id, nom, parent_id').single()
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'Cette catégorie existe déjà à cet endroit.' : error.message }, { status: 400 })
  await logAudit({ acteur_id: acteur!.id, type_action: 'PARAMETRE_MODIFIE', description: `Catégorie de documents « ${avant.nom} » renommée « ${data.nom} »`, ...ipEtAgent(req) })
  return NextResponse.json({ theme: data })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const acteur = await getActeur()
  if (!estAdminCommunications(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const sb = serviceClient()
  const id = (await params).id
  if (!estUuid(id)) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const { data: avant } = await sb.from('themes_documents').select('nom').eq('id', id).maybeSingle()
  if (!avant) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const { count } = await sb.from('themes_documents').select('id', { count: 'exact', head: true }).eq('parent_id', id)
  if (count) return NextResponse.json({ error: 'Retirez d’abord ses sous-catégories.' }, { status: 400 })
  // Les documents restent : on enlève seulement cette catégorie de leur liste
  const { data: docs } = await sb.from('communications').select('id, themes, theme_id').or(`theme_id.eq.${id},themes.cs.{${id}}`)
  for (const d of docs ?? []) {
    const themes = ((d.themes as string[] | null) ?? []).filter(t => t !== id)
    await sb.from('communications').update({ themes, theme_id: themes[0] ?? null }).eq('id', d.id)
  }
  const { error } = await sb.from('themes_documents').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ acteur_id: acteur!.id, type_action: 'PARAMETRE_MODIFIE', description: `Catégorie de documents « ${avant.nom} » retirée (ses documents restent, sans catégorie)`, ...ipEtAgent(req) })
  return NextResponse.json({ ok: true })
}
