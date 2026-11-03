// Types d'événements créés par les admins : POST { nom, emoji, couleur, fond, mode } — toute personne qui crée des événements.
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, peutCreerEvenements, ipEtAgent } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { FONDS_EVENEMENT, TYPES_EVENEMENT } from '@/lib/evenements-types'

export async function POST(req: Request) {
  const acteur = await getActeur()
  if (!acteur || !peutCreerEvenements(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const c = await req.json().catch(() => ({})) as Record<string, unknown>
  const nom = String(c.nom ?? '').trim().slice(0, 60)
  const emoji = String(c.emoji ?? '').trim().slice(0, 8)
  const couleur = String(c.couleur ?? '')
  if (!nom) return NextResponse.json({ error: 'Le nom du type est obligatoire.' }, { status: 400 })
  if (!emoji) return NextResponse.json({ error: 'Choisissez un emoji.' }, { status: 400 })
  if (!/^#[0-9a-f]{6}$/i.test(couleur)) return NextResponse.json({ error: 'Couleur invalide.' }, { status: 400 })
  if (TYPES_EVENEMENT.some(t => t.libelle.toLowerCase() === nom.toLowerCase())) return NextResponse.json({ error: 'Ce type existe déjà.' }, { status: 400 })
  const sb = serviceClient()
  const { data: existant } = await sb.from('evenements_types_perso').select('id, nom, emoji, couleur, fond, mode').ilike('nom', nom).maybeSingle()
  if (existant) return NextResponse.json({ type: existant })
  const fond = FONDS_EVENEMENT.some(f => f.id === c.fond) ? String(c.fond) : null
  const mode = c.mode === 'inscription' ? 'inscription' : 'participation'
  const { data, error } = await sb.from('evenements_types_perso').insert({ nom, emoji, couleur, fond, mode, cree_par: acteur.id }).select('id, nom, emoji, couleur, fond, mode').single()
  if (error) return NextResponse.json({ error: error.message.includes('does not exist') ? 'Module non activé : exécutez la migration evenements_types_perso.sql.' : error.message }, { status: 500 })
  await logAudit({ acteur_id: acteur.id, type_action: 'FORMATION_MODIFIEE', description: `Type d’événement créé : ${emoji} ${nom}`, metadata: { type_id: data.id }, ...ipEtAgent(req) })
  return NextResponse.json({ type: data })
}
