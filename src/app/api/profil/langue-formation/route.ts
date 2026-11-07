import { NextResponse } from 'next/server'
import { getActeur, serviceClient, ipEtAgent } from '@/lib/permissions'
import { changerLangueEmploye } from '@/lib/langues-formation'
import { logAudit } from '@/lib/audit'

/** La personne connectée choisit la langue de ses formations (FR / EN). Uniquement pour elle-même. */
export async function PUT(req: Request) {
  const moi = await getActeur()
  if (!moi) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const corps = await req.json().catch(() => ({}))
  if (corps.langue !== 'fr' && corps.langue !== 'en') return NextResponse.json({ error: 'Langue invalide' }, { status: 400 })
  const r = await changerLangueEmploye(serviceClient(), moi.id, corps.langue)
  if (r.erreur) return NextResponse.json({ error: r.erreur }, { status: 400 })
  await logAudit({
    acteur_id: moi.id, cible_employe_id: moi.id, type_action: 'EMPLOYE_MODIFIE',
    description: `Langue de formation choisie : ${corps.langue === 'en' ? 'anglais' : 'français'} (${r.basculees} assignation(s) non commencée(s) basculée(s))`,
    ...ipEtAgent(req),
  })
  return NextResponse.json({ ok: true, langue: corps.langue, basculees: r.basculees })
}
