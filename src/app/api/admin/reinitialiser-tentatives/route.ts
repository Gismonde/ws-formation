import { NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit'
import { getActeur, serviceClient, peutGererEmploye, ipEtAgent } from '@/lib/permissions'
import { aAccesAdmin } from '@/lib/cliniques'

/**
 * Redonne des tentatives à un employé : ses tentatives échouées sont marquées « annulées »
 * (elles restent conservées comme preuve, mais ne comptent plus dans la limite).
 */
export async function POST(request: Request) {
  const acteur = await getActeur()
  if (!acteur || !aAccesAdmin(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { employeId, formationId } = await request.json()
  const sb = serviceClient()
  const { data: emp } = await sb.from('employes').select('*').eq('id', employeId).single()
  if (!emp || !peutGererEmploye(acteur, emp)) return NextResponse.json({ error: 'Employé introuvable' }, { status: 404 })

  const { data: q } = await sb.from('questionnaires').select('id').eq('formation_id', formationId).eq('actif', true)
  const ids = (q ?? []).map(x => x.id)
  if (ids.length === 0) return NextResponse.json({ error: 'Aucun questionnaire' }, { status: 404 })

  const { data, error } = await sb.from('tentatives_questionnaire').update({ annulee: true })
    .eq('employe_id', employeId).in('questionnaire_id', ids).eq('reussi', false).select('id')
  if (error) {
    const msg = /annulee/.test(error.message) ? 'Exécutez d’abord le script SQL questionnaire_serveur.sql dans Supabase.' : error.message
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const { data: f } = await sb.from('formations').select('titre').eq('id', formationId).single()
  await logAudit({
    acteur_id: acteur.id, cible_employe_id: employeId, formation_id: formationId,
    type_action: 'EMPLOYE_MODIFIE',
    description: `Tentatives du questionnaire « ${f?.titre ?? ''} » remises à zéro pour ${emp.prenom} ${emp.nom} (${(data ?? []).length} tentative(s) échouée(s) annulée(s))`,
    ...ipEtAgent(request),
  })
  return NextResponse.json({ success: true, annulees: (data ?? []).length })
}
