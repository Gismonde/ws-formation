import { NextResponse } from 'next/server'
import { getActeur, serviceClient, ipEtAgent } from '@/lib/permissions'
import { normaliserPronoms } from '@/lib/pronoms'
import { logAudit } from '@/lib/audit'

/** La personne connectée enregistre (ou retire) ses pronoms. Uniquement pour elle-même. */
export async function PUT(req: Request) {
  const moi = await getActeur()
  if (!moi) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const corps = await req.json().catch(() => ({}))
  const pronoms = normaliserPronoms(corps.pronoms)
  const { error } = await serviceClient().from('employes').update({ pronoms }).eq('id', moi.id)
  if (error) return NextResponse.json({ error: /pronoms/.test(error.message) ? 'Exécutez d’abord supabase/migrations/pronoms.sql dans Supabase.' : error.message }, { status: 400 })
  await logAudit({ acteur_id: moi.id, cible_employe_id: moi.id, type_action: 'EMPLOYE_MODIFIE', description: pronoms ? 'Pronoms indiqués dans le profil' : 'Pronoms retirés du profil', ...ipEtAgent(req) })
  return NextResponse.json({ ok: true, pronoms })
}
