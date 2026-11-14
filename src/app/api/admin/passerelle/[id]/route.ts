// La Passerelle. PATCH : modifier une édition (dont la publication). DELETE : la retirer.
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, ipEtAgent } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { lireEdition, peutGererPasserelle, CLINIQUE_PASSERELLE } from '@/lib/passerelle'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acteur = await getActeur()
  if (!peutGererPasserelle(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const v = lireEdition(await req.json().catch(() => ({})))
  if ('erreur' in v) return NextResponse.json({ error: v.erreur }, { status: 400 })
  const { data, error } = await serviceClient().from('passerelle_editions').update({ ...v.valeurs, modifie_le: new Date().toISOString() })
    .eq('id', id).eq('clinique', CLINIQUE_PASSERELLE).select('*').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Édition introuvable' }, { status: 404 })
  await logAudit({ acteur_id: acteur!.id, type_action: 'PARAMETRE_MODIFIE', description: `La Passerelle : édition ${data.numero} ${data.publie ? 'publiée / modifiée' : 'en brouillon'}`, metadata: { edition_id: id }, ...ipEtAgent(req) })
  return NextResponse.json({ edition: data })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acteur = await getActeur()
  if (!peutGererPasserelle(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const { data, error } = await serviceClient().from('passerelle_editions').delete().eq('id', id).eq('clinique', CLINIQUE_PASSERELLE).select('numero')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: 'Édition introuvable' }, { status: 404 })
  await logAudit({ acteur_id: acteur!.id, type_action: 'PARAMETRE_MODIFIE', description: `La Passerelle : édition ${data[0].numero} retirée`, metadata: { edition_id: id }, ...ipEtAgent(req) })
  return NextResponse.json({ ok: true })
}
