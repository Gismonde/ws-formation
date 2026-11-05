// Catégories de rangement des politiques : POST { code, nom, emoji, departements } — administrateurs qui publient des politiques.
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, ipEtAgent } from '@/lib/permissions'
import { peutPublierPolitiques } from '@/lib/politiques'
import { validerCategorie } from '@/lib/politiques-categories-serveur'
import { logAudit } from '@/lib/audit'

export async function POST(req: Request) {
  const acteur = await getActeur()
  if (!acteur || !peutPublierPolitiques(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const sb = serviceClient()
  const v = await validerCategorie(sb, await req.json().catch(() => ({})))
  if ('erreur' in v) return NextResponse.json({ error: v.erreur }, { status: 400 })
  const { data: dern } = await sb.from('politiques_categories').select('ordre').order('ordre', { ascending: false }).limit(1)
  const { data, error } = await sb.from('politiques_categories').insert({ ...v.valeurs, ordre: ((dern?.[0]?.ordre as number) ?? 0) + 1, cree_par: acteur.id }).select('id, code, nom, emoji, departements, ordre').single()
  if (error) return NextResponse.json({ error: error.message.includes('does not exist') ? 'Module non activé : exécutez la migration politiques_categories.sql.' : error.message }, { status: 500 })
  await logAudit({ acteur_id: acteur.id, type_action: 'POLITIQUE_MODIFIEE', description: `Catégorie de politiques créée : ${data.code} — ${data.nom}`, metadata: { categorie_id: data.id }, ...ipEtAgent(req) })
  return NextResponse.json({ categorie: data })
}
