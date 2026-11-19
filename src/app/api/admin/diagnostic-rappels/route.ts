// Diagnostic des tâches quotidiennes (administrateur global).
//  - GET : calcule les rappels du jour sans rien envoyer ni inscrire, et l'état de la table rappels_envoyes.
//  - POST { action: 'envoyer' } : exécute réellement les rappels du jour (comme la tâche quotidienne).
//  - POST { action: 'journees' } : ouvre les journées programmées dont le jour est arrivé, et rapporte les erreurs.
// Les actions qui envoient des courriels passent par POST (jamais déclenchées par un simple lien).
import { NextRequest, NextResponse } from 'next/server'
import { getActeur, serviceClient } from '@/lib/permissions'
import { origineDepuis } from '@/lib/courriels'
import { simulerRappels, executerRappels } from '@/lib/rappels'
import { logAudit } from '@/lib/audit'
import { ouvrirJourneesDues } from '@/lib/journees-ouverture'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function superAdmin() {
  const acteur = await getActeur()
  return acteur?.role === 'super_admin' ? acteur : null
}

export async function GET(req: NextRequest) {
  if (!(await superAdmin())) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const sb = serviceClient()
  const debut = Date.now()
  const resultat = await simulerRappels(sb, origineDepuis(req)).catch(e => ({ erreur: String(e) }))
  const { count } = await sb.from('rappels_envoyes').select('id', { count: 'exact', head: true })
  return NextResponse.json({ duree_ms: Date.now() - debut, rappels_inscrits: count, resultat })
}

export async function POST(req: NextRequest) {
  const acteur = await superAdmin()
  if (!acteur) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const { action } = await req.json().catch(() => ({})) as { action?: string }
  const sb = serviceClient()
  if (action === 'journees') {
    const r = await ouvrirJourneesDues(sb, origineDepuis(req)).catch(e => ({ erreur: e instanceof Error ? e.message : String(e) }))
    await logAudit({ acteur_id: acteur.id, type_action: 'PARAMETRE_MODIFIE', description: 'Ouverture des journées programmées lancée manuellement', metadata: r as Record<string, unknown> })
    return NextResponse.json({ journees: r })
  }
  if (action === 'envoyer') {
    const r = await executerRappels(sb, origineDepuis(req)).catch(e => ({ erreur: String(e) }))
    await logAudit({ acteur_id: acteur.id, type_action: 'PARAMETRE_MODIFIE', description: 'Rappels automatiques lancés manuellement', metadata: r as Record<string, unknown> })
    return NextResponse.json({ resultat: r })
  }
  return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
}
