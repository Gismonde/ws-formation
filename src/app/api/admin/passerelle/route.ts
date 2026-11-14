// La Passerelle (Administration). POST : ajouter une édition.
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, ipEtAgent } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { lireEdition, peutGererPasserelle, CLINIQUE_PASSERELLE } from '@/lib/passerelle'

export async function POST(req: Request) {
  const acteur = await getActeur()
  if (!peutGererPasserelle(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const v = lireEdition(await req.json().catch(() => ({})))
  if ('erreur' in v) return NextResponse.json({ error: v.erreur }, { status: 400 })
  const { data, error } = await serviceClient().from('passerelle_editions').insert({ ...v.valeurs, clinique: CLINIQUE_PASSERELLE, cree_par: acteur!.id }).select('*').single()
  if (error) return NextResponse.json({ error: /passerelle/.test(error.message) ? 'Exécutez d’abord supabase/migrations/passerelle.sql dans Supabase.' : error.message }, { status: 500 })
  await logAudit({ acteur_id: acteur!.id, type_action: 'PARAMETRE_MODIFIE', description: `La Passerelle : édition ${data.numero} ajoutée${data.publie ? ' (publiée)' : ' (brouillon)'}`, metadata: { edition_id: data.id }, ...ipEtAgent(req) })
  return NextResponse.json({ edition: data })
}
