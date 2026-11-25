// POST : nouvelle affiche / communication (brouillon, ou publiée avec courriel facultatif).
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, ipEtAgent } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { lireCommunication, peutGererCommunication, CATEGORIES, categorieDe } from '@/lib/communications'
import { prevenirEmployes } from '@/lib/communications-courriel'

export async function POST(req: Request) {
  const acteur = await getActeur()
  const c = await req.json().catch(() => ({})) as Record<string, unknown>
  const lu = lireCommunication(c)
  if ('erreur' in lu) return NextResponse.json({ error: lu.erreur }, { status: 400 })
  if (!peutGererCommunication(acteur, lu.valeurs.clinique)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const publie = c.publie === true
  const sb = serviceClient()
  const { data, error } = await sb.from('communications').insert({ ...lu.valeurs, publie, publie_le: publie ? new Date().toISOString() : null, cree_par: acteur!.id }).select('*').single()
  if (error) return NextResponse.json({ error: /communications/.test(error.message) ? 'Exécutez d’abord supabase/migrations/communications.sql dans Supabase.' : error.message }, { status: 500 })
  await logAudit({ acteur_id: acteur!.id, type_action: 'PARAMETRE_MODIFIE', description: `${CATEGORIES[categorieDe(data.categorie)].un} « ${data.titre} » ${publie ? 'publiée' : 'créée (brouillon)'}`, clinique: data.clinique === 'LES_DEUX' ? null : data.clinique, ...ipEtAgent(req) })
  const courriels = publie && c.prevenir === true ? await prevenirEmployes(sb, data, req) : null
  return NextResponse.json({ communication: data, courriels })
}
