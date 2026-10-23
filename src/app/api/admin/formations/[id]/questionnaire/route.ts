// Questionnaire d'une formation, pour l'éditeur de cours. GET : lecture ; PUT : enregistrement.
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, peutCreerFormations, peutGererContenu, ipEtAgent } from '@/lib/permissions'
import { lireQuestionnaire, validerQuestionnaire, enregistrerQuestionnaire } from '@/lib/questionnaire-edition'
import { logAudit } from '@/lib/audit'
import { peutModifierFormation, REFUS_MODIFICATION } from '@/lib/droits-formation'

async function autoriser(id: string) {
  const acteur = await getActeur()
  if (!acteur || !peutCreerFormations(acteur)) return { erreur: NextResponse.json({ error: 'Accès refusé' }, { status: 403 }) }
  const sb = serviceClient()
  const { data: f } = await sb.from('formations').select('id, titre, clinique, creee_par').eq('id', id).maybeSingle()
  if (!f) return { erreur: NextResponse.json({ error: 'Formation introuvable' }, { status: 404 }) }
  if (!peutGererContenu(acteur, f.clinique)) return { erreur: NextResponse.json({ error: 'Formation hors de votre périmètre' }, { status: 403 }) }
  if (!peutModifierFormation(acteur, f)) return { erreur: NextResponse.json({ error: REFUS_MODIFICATION }, { status: 403 }) }
  return { acteur, sb, f }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await autoriser((await params).id)
  if ('erreur' in a) return a.erreur
  const q = await lireQuestionnaire(a.sb, a.f.id)
  const { count } = q ? await a.sb.from('tentatives_questionnaire').select('*', { count: 'exact', head: true }).eq('questionnaire_id', q.id) : { count: 0 }
  return NextResponse.json({ questionnaire: q, tentatives: count ?? 0 })
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await autoriser((await params).id)
  if ('erreur' in a) return a.erreur
  const v = validerQuestionnaire(await req.json().catch(() => null))
  if ('erreur' in v) return NextResponse.json({ error: v.erreur }, { status: 400 })
  try {
    const r = await enregistrerQuestionnaire(a.sb, a.f.id, v.valeurs)
    await logAudit({
      acteur_id: a.acteur.id, formation_id: a.f.id, type_action: 'FORMATION_MODIFIEE',
      description: v.valeurs.questions.length
        ? `Questionnaire de « ${a.f.titre} » modifié : ${v.valeurs.questions.length} question(s), seuil ${v.valeurs.note_passage} %, ${v.valeurs.nb_tentatives_max ?? 'illimité'} tentative(s)`
        : `Questionnaire de « ${a.f.titre} » retiré`,
      metadata: { quoi: 'questionnaire', questions: v.valeurs.questions.length, note_passage: v.valeurs.note_passage, nb_tentatives_max: v.valeurs.nb_tentatives_max },
      ...ipEtAgent(req),
    })
    return NextResponse.json(r)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
  }
}
