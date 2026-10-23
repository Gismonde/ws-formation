// Badges côté administration.
//   PUT    { cle, actif, icone, titre, description, seuils } : réglage d'un badge intégré (administrateur global)
//   POST   { nom, description, icone, clinique, formation_ids, actif } : créer un badge de clinique (administrateurs)
//   PATCH  { id, ... } : modifier un badge de clinique ; DELETE ?id= : le supprimer
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, peutGererContenu } from '@/lib/permissions'
import { estAdministrateur } from '@/lib/cliniques'
import { BADGES_INTEGRES } from '@/lib/badges'
import { logAudit } from '@/lib/audit'

const texte = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) || null : null)
const icone = (v: unknown) => (typeof v === 'string' && v.trim() ? Array.from(v.trim()).slice(0, 4).join('') : null)
const UUID = /^[0-9a-f-]{36}$/i

async function acteurAdmin() {
  const a = await getActeur()
  return a && estAdministrateur(a.role) ? a : null
}

export async function PUT(req: Request) {
  const a = await acteurAdmin()
  if (!a || a.role !== 'super_admin') return NextResponse.json({ error: 'Réservé à l’administrateur global' }, { status: 403 })
  const b = await req.json().catch(() => ({})) as Record<string, unknown>
  const def = BADGES_INTEGRES.find(x => x.cle === b.cle)
  if (!def) return NextResponse.json({ error: 'Badge inconnu' }, { status: 400 })
  const seuils = def.seuils && Array.isArray(b.seuils)
    ? Array.from(new Set((b.seuils as unknown[]).map(Number).filter(n => Number.isInteger(n) && n > 0 && n <= 1000))).sort((x, y) => x - y).slice(0, 8)
    : null
  if (def.seuils && seuils && seuils.length === 0) return NextResponse.json({ error: 'Indiquez au moins un seuil (nombre entier positif).' }, { status: 400 })
  const ligne = {
    cle: def.cle, actif: b.actif !== false,
    icone: def.multiples ? null : icone(b.icone), titre: def.multiples ? null : texte(b.titre, 80), description: def.multiples ? null : texte(b.description, 200),
    seuils, modifie_par: a.id, modifie_le: new Date().toISOString(),
  }
  const { error } = await serviceClient().from('badges_reglages').upsert(ligne)
  if (error) return NextResponse.json({ error: error.message.includes('badges_reglages') ? 'Exécutez d’abord supabase/migrations/badges_admin.sql dans Supabase.' : error.message }, { status: 500 })
  await logAudit({ acteur_id: a.id, type_action: 'PARAMETRE_MODIFIE', description: `Badge « ${def.titre} » réglé`, metadata: ligne }).catch(() => {})
  return NextResponse.json({ ok: true })
}

function lirePerso(b: Record<string, unknown>) {
  const nom = texte(b.nom, 80)
  if (!nom) return { erreur: 'Donnez un nom au badge.' }
  const formation_ids = Array.isArray(b.formation_ids) ? Array.from(new Set((b.formation_ids as unknown[]).filter((x): x is string => typeof x === 'string' && UUID.test(x)))).slice(0, 50) : []
  if (formation_ids.length === 0) return { erreur: 'Choisissez au moins une formation à terminer.' }
  const clinique = ['CMC', 'WSSC', 'LES_DEUX'].includes(b.clinique as string) ? (b.clinique as string) : null
  if (!clinique) return { erreur: 'Clinique invalide' }
  return { valeurs: { nom, description: texte(b.description, 200), icone: icone(b.icone) ?? '⭐', clinique, formation_ids, actif: b.actif !== false } }
}

export async function POST(req: Request) {
  const a = await acteurAdmin()
  if (!a) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const v = lirePerso(await req.json().catch(() => ({})))
  if ('erreur' in v) return NextResponse.json({ error: v.erreur }, { status: 400 })
  if (!peutGererContenu(a, v.valeurs!.clinique)) return NextResponse.json({ error: 'Clinique non permise' }, { status: 403 })
  const { error } = await serviceClient().from('badges_perso').insert({ ...v.valeurs, cree_par: a.id })
  if (error) return NextResponse.json({ error: error.message.includes('badges_perso') ? 'Exécutez d’abord supabase/migrations/badges_admin.sql dans Supabase.' : error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: Request) {
  const a = await acteurAdmin()
  if (!a) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const b = await req.json().catch(() => ({})) as Record<string, unknown>
  const sb = serviceClient()
  const { data: ex } = typeof b.id === 'string' ? await sb.from('badges_perso').select('clinique').eq('id', b.id).maybeSingle() : { data: null }
  if (!ex || !peutGererContenu(a, ex.clinique)) return NextResponse.json({ error: 'Badge introuvable' }, { status: 404 })
  const v = lirePerso(b)
  if ('erreur' in v) return NextResponse.json({ error: v.erreur }, { status: 400 })
  if (!peutGererContenu(a, v.valeurs!.clinique)) return NextResponse.json({ error: 'Clinique non permise' }, { status: 403 })
  const { error } = await sb.from('badges_perso').update(v.valeurs!).eq('id', b.id as string)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const a = await acteurAdmin()
  if (!a) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const id = new URL(req.url).searchParams.get('id') ?? ''
  const sb = serviceClient()
  const { data: ex } = UUID.test(id) ? await sb.from('badges_perso').select('clinique').eq('id', id).maybeSingle() : { data: null }
  if (!ex || !peutGererContenu(a, ex.clinique)) return NextResponse.json({ error: 'Badge introuvable' }, { status: 404 })
  const { error } = await sb.from('badges_perso').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
