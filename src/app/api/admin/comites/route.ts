// Comités (Administration → Comités). POST : créer un comité.
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, ipEtAgent } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { lireComite, peutGererComites, CLINIQUE_COMITES, messageMigration } from '@/lib/comites'

export async function POST(req: Request) {
  const acteur = await getActeur()
  if (!peutGererComites(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const v = lireComite(await req.json().catch(() => ({})))
  if ('erreur' in v) return NextResponse.json({ error: v.erreur }, { status: 400 })
  const { data, error } = await serviceClient().from('comites').insert({ ...v.valeurs, clinique: CLINIQUE_COMITES, cree_par: acteur!.id }).select('*').single()
  if (error) return NextResponse.json({ error: /image|incident/.test(error.message) ? 'Exécutez d’abord les dernières lignes de supabase/migrations/comites.sql (colonnes image et incident).' : messageMigration(error.message) }, { status: 500 })
  await logAudit({ acteur_id: acteur!.id, type_action: 'PARAMETRE_MODIFIE', description: `Comité créé : ${data.nom}${data.publie ? ' (publié)' : ' (brouillon)'}`, metadata: { comite_id: data.id }, ...ipEtAgent(req) })
  return NextResponse.json({ comite: data })
}
