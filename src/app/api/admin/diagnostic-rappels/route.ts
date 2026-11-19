// GET : diagnostic des rappels automatiques (administrateur global). Calcule ce que la tâche du jour
// enverrait, sans rien envoyer ni inscrire. Indique aussi l'état de la table rappels_envoyes.
import { NextRequest, NextResponse } from 'next/server'
import { getActeur, serviceClient } from '@/lib/permissions'
import { origineDepuis } from '@/lib/courriels'
import { simulerRappels } from '@/lib/rappels'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const acteur = await getActeur()
  if (acteur?.role !== 'super_admin') return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const sb = serviceClient()
  const debut = Date.now()
  const resultat = await simulerRappels(sb, origineDepuis(req)).catch(e => ({ erreur: String(e) }))
  const { count } = await sb.from('rappels_envoyes').select('id', { count: 'exact', head: true })
  return NextResponse.json({ duree_ms: Date.now() - debut, rappels_inscrits: count, resultat })
}
