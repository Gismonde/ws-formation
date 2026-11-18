// PUT { titre, texte, image } : bannière « comités » de la page d'accueil (espace WSSC).
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, ipEtAgent } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { lireBanniere, peutGererComites, CLE_BANNIERE_COMITES } from '@/lib/comites'

export async function PUT(req: Request) {
  const acteur = await getActeur()
  if (!peutGererComites(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const valeur = lireBanniere(await req.json().catch(() => ({})))
  const { error } = await serviceClient().from('reglages').upsert({ cle: CLE_BANNIERE_COMITES, valeur, modifie_par: acteur!.id, modifie_le: new Date().toISOString() })
  if (error) return NextResponse.json({ error: /reglages/.test(error.message) ? 'Exécutez d’abord supabase/migrations/comites.sql (table reglages) dans Supabase.' : error.message }, { status: 500 })
  await logAudit({ acteur_id: acteur!.id, type_action: 'PARAMETRE_MODIFIE', description: 'Bannière des comités (page d’accueil) modifiée', metadata: { image: !!valeur.image }, ...ipEtAgent(req) })
  return NextResponse.json({ banniere: valeur })
}
