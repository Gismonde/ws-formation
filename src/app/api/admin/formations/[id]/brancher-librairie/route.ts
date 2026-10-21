// Brancher la librairie sur une formation.
// GET : aperçu des correspondances (rien n'est modifié). POST { blocs?: string[] } : applique.
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, peutCreerFormations, peutGererContenu } from '@/lib/permissions'
import { blocsEnAttente, correspondances, blocDepuisElement } from '@/lib/brancher-librairie'
import { logAudit } from '@/lib/audit'

async function preparer(id: string) {
  const acteur = await getActeur()
  if (!acteur || !peutCreerFormations(acteur)) return { erreur: NextResponse.json({ error: 'Accès refusé' }, { status: 403 }) }
  const sb = serviceClient()
  const { data: f } = await sb.from('formations').select('id, titre, clinique').eq('id', id).maybeSingle()
  if (!f) return { erreur: NextResponse.json({ error: 'Formation introuvable' }, { status: 404 }) }
  if (!peutGererContenu(acteur, f.clinique)) return { erreur: NextResponse.json({ error: 'Formation hors de votre périmètre' }, { status: 403 }) }
  const cliniques = f.clinique === 'LES_DEUX' ? ['CMC', 'WSSC', 'LES_DEUX'] : [f.clinique ?? 'LES_DEUX', 'LES_DEUX']
  const { data: elements } = await sb.from('librairie').select('id, titre, type, url, nom_fichier').eq('archive', false).in('clinique', cliniques)
  const liste = correspondances(await blocsEnAttente(sb, id), elements ?? [])
  return { acteur, sb, f, liste }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const p = await preparer((await params).id)
  if ('erreur' in p) return p.erreur
  return NextResponse.json({ correspondances: p.liste })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const p = await preparer((await params).id)
  if ('erreur' in p) return p.erreur
  const corps = await req.json().catch(() => ({})) as { blocs?: unknown }
  const choisis = Array.isArray(corps.blocs) ? new Set(corps.blocs.filter((x): x is string => typeof x === 'string')) : null
  let branches = 0
  for (const c of p.liste) {
    if (!c.element || (choisis && !choisis.has(c.bloc_id))) continue
    const { error } = await p.sb.from('content_blocks').update(blocDepuisElement(c.element)).eq('id', c.bloc_id)
    if (!error) branches++
  }
  if (branches) {
    await logAudit({ acteur_id: p.acteur.id, formation_id: p.f.id, type_action: 'FORMATION_MODIFIEE', description: `Librairie branchée sur « ${p.f.titre} » : ${branches} bloc(s)`, metadata: { formation_id: p.f.id, blocs: branches } })
  }
  const restants = p.liste.filter(c => !c.element).length
  return NextResponse.json({ branches, restants })
}
