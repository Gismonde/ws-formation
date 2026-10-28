// Catégories de la librairie : liste (GET), ajout (POST), renommage / déplacement (PATCH), suppression (DELETE ?id=).
// Lecture : personnes qui ont accès à la librairie. Gestion : administrateurs.
import { NextRequest, NextResponse } from 'next/server'
import { getActeur, serviceClient } from '@/lib/permissions'
import { peutVoirLibrairie } from '@/lib/librairie'
import { deplacer, nomValide, type CategorieLibrairie } from '@/lib/librairie-categories'
import { logAudit } from '@/lib/audit'

const MIGRATION = 'Exécutez d’abord supabase/migrations/librairie_categories.sql dans Supabase.'
const absente = (e: { code?: string; message: string }) => e.code === '42P01' || /librairie_categories/.test(e.message)

async function lire() {
  const { data, error } = await serviceClient().from('librairie_categories').select('id, nom, parent_id, ordre')
  return { liste: (data ?? []) as CategorieLibrairie[], error }
}

async function autoriser(gestion: boolean) {
  const a = await getActeur()
  if (!a || !peutVoirLibrairie(a)) return null
  if (gestion && a.role !== 'super_admin' && a.role !== 'admin') return null
  return a
}

export async function GET() {
  if (!(await autoriser(false))) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const { liste, error } = await lire()
  if (error) return NextResponse.json({ error: absente(error) ? MIGRATION : error.message, categories: [] }, { status: absente(error) ? 503 : 500 })
  return NextResponse.json({ categories: liste })
}

export async function POST(req: Request) {
  const a = await autoriser(true)
  if (!a) return NextResponse.json({ error: 'Seuls les administrateurs gèrent les catégories.' }, { status: 403 })
  const corps = await req.json().catch(() => ({}))
  const nom = nomValide(corps.nom)
  if (!nom) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })
  const { liste, error: e0 } = await lire()
  if (e0) return NextResponse.json({ error: absente(e0) ? MIGRATION : e0.message }, { status: 500 })
  if (liste.some(c => c.nom.toLowerCase() === nom.toLowerCase())) return NextResponse.json({ error: 'Cette catégorie existe déjà.' }, { status: 400 })
  const parent = typeof corps.parent_id === 'string' ? liste.find(c => c.id === corps.parent_id) : null
  if (parent && parent.parent_id) return NextResponse.json({ error: 'Deux niveaux au maximum : choisissez une catégorie principale.' }, { status: 400 })
  const ordre = Math.max(0, ...liste.filter(c => (c.parent_id ?? null) === (parent?.id ?? null)).map(c => c.ordre)) + 1
  const { data, error } = await serviceClient().from('librairie_categories').insert({ nom, parent_id: parent?.id ?? null, ordre }).select('id, nom, parent_id, ordre').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ acteur_id: a.id, type_action: 'PARAMETRE_MODIFIE', description: `Librairie : catégorie « ${nom} » ajoutée${parent ? ` sous « ${parent.nom} »` : ''}` })
  return NextResponse.json({ categorie: data })
}

export async function PATCH(req: Request) {
  const a = await autoriser(true)
  if (!a) return NextResponse.json({ error: 'Seuls les administrateurs gèrent les catégories.' }, { status: 403 })
  const corps = await req.json().catch(() => ({}))
  const sb = serviceClient()
  const { liste } = await lire()
  const c = liste.find(x => x.id === corps.id)
  if (!c) return NextResponse.json({ error: 'Catégorie introuvable' }, { status: 404 })

  if (corps.sens === -1 || corps.sens === 1) {
    for (const o of deplacer(liste, c.id, corps.sens)) await sb.from('librairie_categories').update({ ordre: o.ordre }).eq('id', o.id)
    return NextResponse.json({ ok: true })
  }
  const maj: Record<string, unknown> = {}
  if (corps.nom !== undefined) {
    const nom = nomValide(corps.nom)
    if (!nom) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })
    if (liste.some(x => x.id !== c.id && x.nom.toLowerCase() === nom.toLowerCase())) return NextResponse.json({ error: 'Cette catégorie existe déjà.' }, { status: 400 })
    maj.nom = nom
  }
  if (corps.parent_id !== undefined) {
    const parent = corps.parent_id ? liste.find(x => x.id === corps.parent_id) : null
    if (corps.parent_id && (!parent || parent.parent_id || parent.id === c.id)) return NextResponse.json({ error: 'Catégorie principale invalide (deux niveaux au maximum).' }, { status: 400 })
    if (parent && liste.some(x => x.parent_id === c.id)) return NextResponse.json({ error: 'Cette catégorie a des sous-catégories : elle doit rester principale.' }, { status: 400 })
    maj.parent_id = parent?.id ?? null
  }
  const { error } = await sb.from('librairie_categories').update(maj).eq('id', c.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // Renommage : les éléments de la librairie suivent
  if (maj.nom && maj.nom !== c.nom) await sb.from('librairie').update({ categorie: maj.nom }).eq('categorie', c.nom)
  await logAudit({ acteur_id: a.id, type_action: 'PARAMETRE_MODIFIE', description: maj.nom && maj.nom !== c.nom ? `Librairie : catégorie « ${c.nom} » renommée « ${maj.nom} »` : `Librairie : catégorie « ${c.nom} » déplacée` })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const a = await autoriser(true)
  if (!a) return NextResponse.json({ error: 'Seuls les administrateurs gèrent les catégories.' }, { status: 403 })
  const id = req.nextUrl.searchParams.get('id')
  const sb = serviceClient()
  const { liste } = await lire()
  const c = liste.find(x => x.id === id)
  if (!c) return NextResponse.json({ error: 'Catégorie introuvable' }, { status: 404 })
  // Les sous-catégories deviennent principales ; les éléments passent « sans catégorie »
  await sb.from('librairie_categories').update({ parent_id: null }).eq('parent_id', c.id)
  const { count } = await sb.from('librairie').update({ categorie: null }, { count: 'exact' }).eq('categorie', c.nom)
  const { error } = await sb.from('librairie_categories').delete().eq('id', c.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ acteur_id: a.id, type_action: 'PARAMETRE_MODIFIE', description: `Librairie : catégorie « ${c.nom} » supprimée (${count ?? 0} élément(s) sans catégorie)` })
  return NextResponse.json({ ok: true, elements: count ?? 0 })
}
