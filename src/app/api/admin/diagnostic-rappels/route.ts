// GET : diagnostic des rappels automatiques (administrateur global). Calcule ce que la tâche du jour
// enverrait, sans rien envoyer ni inscrire (?envoyer=1 : les envoie vraiment). Indique aussi l'état de la table rappels_envoyes.
import { NextRequest, NextResponse } from 'next/server'
import { getActeur, serviceClient } from '@/lib/permissions'
import { origineDepuis } from '@/lib/courriels'
import { simulerRappels, executerRappels } from '@/lib/rappels'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const acteur = await getActeur()
  if (acteur?.role !== 'super_admin') return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const sb = serviceClient()
  const debut = Date.now()
  // ?envoyer=1 : exécute réellement les rappels du jour (comme la tâche quotidienne)
  const envoyer = req.nextUrl.searchParams.get('envoyer') === '1'
  const resultat = await (envoyer ? executerRappels : simulerRappels)(sb, origineDepuis(req)).catch(e => ({ erreur: String(e) }))
  if (envoyer) await logAudit({ acteur_id: acteur.id, type_action: 'PARAMETRE_MODIFIE', description: 'Rappels automatiques lancés manuellement', metadata: resultat as Record<string, unknown> })
  const { count } = await sb.from('rappels_envoyes').select('id', { count: 'exact', head: true })
  return NextResponse.json({ duree_ms: Date.now() - debut, rappels_inscrits: count, resultat })
}
