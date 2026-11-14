// PUT { titre, texte } : encadré « On veut vous lire ! » de La Passerelle.
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, ipEtAgent } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { APPEL_DEFAUT, CLE_APPEL_PASSERELLE, peutGererPasserelle } from '@/lib/passerelle'

export async function PUT(req: Request) {
  const acteur = await getActeur()
  if (!peutGererPasserelle(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const c = await req.json().catch(() => ({}))
  const valeur = { titre: String(c.titre ?? '').trim().slice(0, 120) || APPEL_DEFAUT.titre, texte: String(c.texte ?? '').trim().slice(0, 3000) }
  const { error } = await serviceClient().from('reglages').upsert({ cle: CLE_APPEL_PASSERELLE, valeur, modifie_par: acteur!.id, modifie_le: new Date().toISOString() })
  if (error) return NextResponse.json({ error: /reglages/.test(error.message) ? 'Exécutez d’abord supabase/migrations/passerelle.sql dans Supabase.' : error.message }, { status: 500 })
  await logAudit({ acteur_id: acteur!.id, type_action: 'PARAMETRE_MODIFIE', description: 'La Passerelle : encadré « On veut vous lire ! » modifié', ...ipEtAgent(req) })
  return NextResponse.json({ appel: valeur })
}
