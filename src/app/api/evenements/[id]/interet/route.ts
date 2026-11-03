// « Me prévenir » pour un événement dont la date est à venir. POST : s'ajouter ; DELETE : se retirer.
import { NextResponse } from 'next/server'
import { getActeur, serviceClient } from '@/lib/permissions'
import { chargerEvenement, estInvite } from '@/lib/evenements'

async function contexte(id: string) {
  const acteur = await getActeur()
  if (!acteur) return { erreur: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) }
  const sb = serviceClient()
  const d = await chargerEvenement(sb, id)
  if (!d || d.ev.statut !== 'publie' || !estInvite(d.ev, acteur)) return { erreur: NextResponse.json({ error: 'Événement introuvable' }, { status: 404 }) }
  return { acteur, sb }
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const c = await contexte(id)
  if ('erreur' in c) return c.erreur
  const { error } = await c.sb.from('evenements_interets').upsert({ evenement_id: id, employe_id: c.acteur.id, avise_le: null }, { onConflict: 'evenement_id,employe_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const c = await contexte(id)
  if ('erreur' in c) return c.erreur
  await c.sb.from('evenements_interets').delete().eq('evenement_id', id).eq('employe_id', c.acteur.id)
  return NextResponse.json({ ok: true })
}
