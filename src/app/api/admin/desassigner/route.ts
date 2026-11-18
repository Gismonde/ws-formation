// POST { employeId, formationId } : retire l'assignation (voir lib/desassigner).
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, ipEtAgent } from '@/lib/permissions'
import { aAccesAdmin } from '@/lib/cliniques'
import { desassignerFormation } from '@/lib/desassigner'

export async function POST(req: Request) {
  const acteur = await getActeur()
  if (!acteur || !aAccesAdmin(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const { employeId, formationId } = await req.json().catch(() => ({}))
  if (typeof employeId !== 'string' || typeof formationId !== 'string') return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  const r = await desassignerFormation(serviceClient(), acteur, employeId, formationId, ipEtAgent(req))
  if (!r.ok) return NextResponse.json({ error: r.erreur }, { status: r.statut })
  return NextResponse.json({ ok: true, retirees: r.retirees })
}
