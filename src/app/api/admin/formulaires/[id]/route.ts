// Modification d'un formulaire (créateur ou administrateur global) ; PATCH : publier / retirer / archiver.
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, ipEtAgent } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { peutModifierFormulaire, type Formulaire } from '@/lib/formulaires'
import { validerFormulaire } from '@/lib/formulaires-serveur'

async function charger(id: string) {
  const a = await getActeur()
  if (!a) return { refus: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) }
  const sb = serviceClient()
  const { data } = await sb.from('formulaires').select('*').eq('id', id).maybeSingle()
  if (!data || !peutModifierFormulaire(a, data as Formulaire)) return { refus: NextResponse.json({ error: 'Formulaire introuvable' }, { status: 404 }) }
  return { a, sb, f: data as Formulaire }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await charger((await params).id)
  if ('refus' in c) return c.refus
  const v = await validerFormulaire(c.sb, c.a, await req.json().catch(() => ({})))
  if ('erreur' in v) return NextResponse.json({ error: v.erreur }, { status: 400 })
  const { error } = await c.sb.from('formulaires').update({ ...v.valeurs, updated_at: new Date().toISOString() }).eq('id', c.f.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ acteur_id: c.a.id, type_action: 'FORMULAIRE_MODIFIE', description: `Formulaire « ${v.valeurs.titre} » modifié`, metadata: { formulaire_id: c.f.id }, ...ipEtAgent(req) })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await charger((await params).id)
  if ('refus' in c) return c.refus
  const b = await req.json().catch(() => ({})) as { actif?: boolean; archive?: boolean }
  const maj: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof b.actif === 'boolean') maj.actif = b.actif
  if (typeof b.archive === 'boolean') { maj.archive = b.archive; if (b.archive) maj.actif = false }
  const { error } = await c.sb.from('formulaires').update(maj).eq('id', c.f.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const quoi = b.archive ? 'archivé' : b.archive === false ? 'désarchivé' : b.actif ? 'publié' : 'retiré'
  await logAudit({ acteur_id: c.a.id, type_action: 'FORMULAIRE_MODIFIE', description: `Formulaire « ${c.f.titre} » ${quoi}`, metadata: { formulaire_id: c.f.id, ...b }, ...ipEtAgent(req) })
  return NextResponse.json({ ok: true })
}
