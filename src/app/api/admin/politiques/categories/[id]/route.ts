// Modifier (PATCH) ou supprimer (DELETE) une catégorie de politiques. Supprimer ne supprime aucune politique : elles deviennent « Sans catégorie ».
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, ipEtAgent } from '@/lib/permissions'
import { peutPublierPolitiques } from '@/lib/politiques'
import { validerCategorie } from '@/lib/politiques-categories-serveur'
import { logAudit } from '@/lib/audit'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acteur = await getActeur()
  if (!acteur || !peutPublierPolitiques(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const sb = serviceClient()
  const v = await validerCategorie(sb, await req.json().catch(() => ({})), id)
  if ('erreur' in v) return NextResponse.json({ error: v.erreur }, { status: 400 })
  const { data, error } = await sb.from('politiques_categories').update(v.valeurs).eq('id', id).select('id, code, nom, emoji, departements, ordre').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ acteur_id: acteur.id, type_action: 'POLITIQUE_MODIFIEE', description: `Catégorie de politiques modifiée : ${data.code} — ${data.nom}`, metadata: { categorie_id: id }, ...ipEtAgent(req) })
  return NextResponse.json({ categorie: data })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acteur = await getActeur()
  if (!acteur || !peutPublierPolitiques(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const sb = serviceClient()
  const { data: cat } = await sb.from('politiques_categories').select('code, nom').eq('id', id).maybeSingle()
  if (!cat) return NextResponse.json({ error: 'Catégorie introuvable' }, { status: 404 })
  await sb.from('politiques').update({ categorie_id: null }).eq('categorie_id', id)
  const { error } = await sb.from('politiques_categories').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ acteur_id: acteur.id, type_action: 'POLITIQUE_MODIFIEE', description: `Catégorie de politiques supprimée : ${cat.code} — ${cat.nom}`, metadata: { categorie_id: id }, ...ipEtAgent(req) })
  return NextResponse.json({ ok: true })
}
