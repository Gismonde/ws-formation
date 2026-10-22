// Rappels automatiques quotidiens (certificats qui expirent, formations en retard).
// Appelé par Vercel Cron (vercel.json) avec l'en-tête « Authorization: Bearer <CRON_SECRET> ».
// Variable Vercel requise : CRON_SECRET (sans elle, la route refuse tout appel).
import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { serviceClient } from '@/lib/permissions'
import { origineDepuis } from '@/lib/courriels'
import { executerRappels } from '@/lib/rappels'
import { tachesEvenements } from '@/lib/evenements-courriels'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function autorise(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const recu = Buffer.from(req.headers.get('authorization') ?? '')
  const attendu = Buffer.from(`Bearer ${secret}`)
  return recu.length === attendu.length && timingSafeEqual(recu, attendu)
}

export async function GET(req: NextRequest) {
  if (!autorise(req)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const sb = serviceClient()
  const resultat = await executerRappels(sb, origineDepuis(req))
  const evenements = await tachesEvenements(sb, origineDepuis(req)).catch(e => ({ erreur: String(e) }))
  console.log('[Événements]', JSON.stringify(evenements))
  console.log('[Rappels]', JSON.stringify(resultat))
  return NextResponse.json({ ...resultat, evenements })
}
