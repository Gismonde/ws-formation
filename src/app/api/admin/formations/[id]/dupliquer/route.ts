// Duplique une formation. POST { clinique, titre? } — créateurs de formations, cliniques gérées seulement.
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, peutCreerFormations, peutGererContenu, peutVoirContenu, ipEtAgent } from '@/lib/permissions'
import { dupliquerFormation } from '@/lib/dupliquer-formation'
import { logAudit } from '@/lib/audit'
import type { CliniqueContenu } from '@/lib/cliniques'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acteur = await getActeur()
  if (!acteur || !peutCreerFormations(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const sb = serviceClient()
  const { data: f } = await sb.from('formations').select('id, titre, clinique').eq('id', id).maybeSingle()
  if (!f || !peutVoirContenu(acteur, f.clinique)) return NextResponse.json({ error: 'Formation introuvable' }, { status: 404 })
  const corps = await req.json().catch(() => ({})) as { clinique?: string; titre?: string }
  const clinique = (['CMC', 'WSSC', 'LES_DEUX'].includes(corps.clinique ?? '') ? corps.clinique : f.clinique) as CliniqueContenu
  if (!peutGererContenu(acteur, clinique)) return NextResponse.json({ error: 'Vous ne pouvez pas créer de formation pour cette clinique.' }, { status: 403 })
  const titre = (typeof corps.titre === 'string' && corps.titre.trim() ? corps.titre.trim() : `${f.titre} (copie)`).slice(0, 300)
  try {
    const r = await dupliquerFormation(sb, f.id, { clinique, titre, creePar: acteur.id })
    await logAudit({
      acteur_id: acteur.id, formation_id: r.id, type_action: 'FORMATION_CREEE',
      description: `Formation « ${titre} » créée par duplication de « ${f.titre} » (${clinique}) : ${r.modules} module(s), ${r.lecons} leçon(s), ${r.questions} question(s)`,
      metadata: { source: f.id, ...r }, ...ipEtAgent(req),
    })
    return NextResponse.json(r)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
  }
}
