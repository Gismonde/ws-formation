import { NextRequest, NextResponse } from 'next/server'
import { getActeur, serviceClient } from '@/lib/permissions'
import { porteeClinique, lireFiltresAudit, employesConcernes, requeteAudit } from '@/lib/audit-journal'
import { estAdministrateur } from '@/lib/cliniques'

export async function GET(request: NextRequest) {
  // Journal d'audit : administrateurs seulement, limité à leur périmètre
  const acteur = await getActeur()
  if (!acteur) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!estAdministrateur(acteur.role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const sb = serviceClient()
  const sp = new URL(request.url).searchParams
  const filtres = porteeClinique(lireFiltresAudit(sp), acteur)
  const page = Math.max(1, parseInt(sp.get('page') || '1') || 1)
  const limit = Math.min(200, Math.max(1, parseInt(sp.get('limit') || '50') || 50))

  const employes = await employesConcernes(sb, acteur, filtres)
  const q = requeteAudit(sb, filtres, employes?.map(e => e.id) ?? null, { compter: true })
  if (!q) return NextResponse.json({ logs: [], count: 0, page, limit })
  const { data: logs, error, count } = await q.range((page - 1) * limit, page * limit - 1)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ logs, count, page, limit })
}
