// PATCH { statut?, note? } : suivi d'une proposition par les personnes qui les reçoivent.
import { NextResponse } from 'next/server'
import { getActeur, serviceClient } from '@/lib/permissions'
import { estStatut } from '@/lib/passerelle-propositions'
import { gerePasserelle } from '@/lib/passerelle'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acteur = await getActeur()
  const sb = serviceClient()
  if (!await gerePasserelle(sb, acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const c = await req.json().catch(() => ({})) as { statut?: unknown; note?: unknown }
  const maj: Record<string, unknown> = { traite_par: acteur!.id, traite_le: new Date().toISOString() }
  if (c.statut !== undefined) { if (!estStatut(c.statut)) return NextResponse.json({ error: 'Statut inconnu' }, { status: 400 }); maj.statut = c.statut }
  if (c.note !== undefined) maj.note = String(c.note ?? '').trim().slice(0, 2000)
  const { error } = await sb.from('passerelle_propositions').update(maj).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
