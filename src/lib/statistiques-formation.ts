// Statistiques d'une formation (page Admin → formation → Statistiques).
// Portée de l'acteur : seuls les employés qu'il peut suivre sont comptés.
import type { SupabaseClient } from '@supabase/supabase-js'
import { type Acteur, idsEmployesDansPortee } from '@/lib/permissions'
import { chargerConformite } from '@/lib/conformite'
import { estComplete, type StatutFormation } from '@/lib/etat-formations'
import { agregerReponses, chargerReponses, sondagesDisponibles, type ResultatsSondage } from '@/lib/sondages'

export type LigneEmployeStat = {
  id: string; nom: string; departement: string; statut: StatutFormation; progression: number
  date_assignation: string | null; date_echeance: string | null; en_retard: boolean
}
export type StatistiquesFormation = {
  totaux: { assignes: number; commences: number; termines: number; certifies: number; en_retard: number; taux: number }
  delaiMoyenJours: number | null
  lecons: { id: string; titre: string; module: string; commencees: number; terminees: number }[]
  questionnaire: null | {
    tentatives: number; employes: number; reussis: number; premierEssai: number; scoreMoyen: number | null; dureeMoyenneMin: number | null
    questions: { id: string; texte: string; repondues: number; taux: number }[]
  }
  departements: { nom: string; assignes: number; termines: number; taux: number }[]
  sondage: ResultatsSondage | null
  employes: LigneEmployeStat[]
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0)
const jours = (de: string, a: string) => (Date.parse(a) - Date.parse(de)) / 86_400_000

/** Taux de réussite par question à partir des réponses enregistrées (fonction pure, testée) */
export function reussiteParQuestion(
  questions: { id: string; texte: string; bonne: string | null }[],
  tentatives: { reponses: Record<string, string> }[],
) {
  return questions.map(q => {
    const avecReponse = tentatives.filter(t => q.id in t.reponses)
    const justes = avecReponse.filter(t => q.bonne !== null && t.reponses[q.id] === q.bonne).length
    return { id: q.id, texte: q.texte, repondues: avecReponse.length, taux: pct(justes, avecReponse.length) }
  }).sort((a, b) => a.taux - b.taux)
}

function lireReponses(brut: unknown): Record<string, string> {
  try {
    const v = typeof brut === 'string' ? JSON.parse(brut) : brut
    return v && typeof v === 'object' ? (v as Record<string, string>) : {}
  } catch { return {} }
}

export async function statistiquesFormation(sb: SupabaseClient, acteur: Acteur, formationId: string): Promise<StatistiquesFormation> {
  const portee = await idsEmployesDansPortee(acteur, sb)

  // Employés assignés (portée de l'acteur), avec leur état réel
  const { data: assign } = await sb.from('assignations').select('employe_id').eq('formation_id', formationId)
  const assignesIds = Array.from(new Set((assign ?? []).map(a => a.employe_id as string))).filter(id => !portee || portee.includes(id))
  const conformite = assignesIds.length ? await chargerConformite(sb, acteur, { employe_ids: assignesIds }) : []
  const employes: LigneEmployeStat[] = conformite.flatMap(e => e.assignations.filter(a => a.formation_id === formationId).map(a => ({
    id: e.id, nom: `${e.prenom} ${e.nom}`.trim(), departement: e.departement || '—', statut: a.statut, progression: a.progression,
    date_assignation: a.date_assignation, date_echeance: a.date_echeance, en_retard: a.en_retard,
  }))).sort((x, y) => x.nom.localeCompare(y.nom, 'fr'))
  const ids = employes.map(e => e.id)

  const termines = employes.filter(e => estComplete(e.statut)).length
  const totaux = {
    assignes: employes.length,
    commences: employes.filter(e => e.statut !== 'non_commence').length,
    termines,
    certifies: employes.filter(e => e.statut === 'certifie').length,
    en_retard: employes.filter(e => e.en_retard).length,
    taux: pct(termines, employes.length),
  }

  // Leçons : entonnoir (commencées / terminées)
  const { data: modules } = await sb.from('modules').select('id, titre, ordre').eq('formation_id', formationId).order('ordre')
  const { data: lecons } = (modules ?? []).length
    ? await sb.from('lessons').select('id, titre, ordre, module_id').in('module_id', (modules ?? []).map(m => m.id)).order('ordre')
    : { data: [] as { id: string; titre: string; ordre: number; module_id: string }[] }
  const leconsOrdonnees = (modules ?? []).flatMap(m => (lecons ?? []).filter(l => l.module_id === m.id).map(l => ({ ...l, module: m.titre as string })))
  const { data: lp } = leconsOrdonnees.length && ids.length
    ? await sb.from('lesson_progressions').select('employe_id, lesson_id, statut, date_fin').in('lesson_id', leconsOrdonnees.map(l => l.id)).in('employe_id', ids)
    : { data: [] as { employe_id: string; lesson_id: string; statut: string; date_fin: string | null }[] }
  const statLecons = leconsOrdonnees.map(l => {
    const lignes = (lp ?? []).filter(x => x.lesson_id === l.id)
    return { id: l.id as string, titre: l.titre as string, module: l.module, commencees: new Set(lignes.map(x => x.employe_id)).size, terminees: lignes.filter(x => x.statut === 'termine').length }
  })

  // Délai moyen assignation → fin (certificat, sinon dernière leçon terminée)
  const { data: certs } = ids.length ? await sb.from('certificats').select('employe_id, date_emission').eq('formation_id', formationId).in('employe_id', ids) : { data: [] }
  const delais: number[] = []
  for (const e of employes.filter(x => estComplete(x.statut) && x.date_assignation)) {
    const cert = (certs ?? []).find(c => c.employe_id === e.id)?.date_emission as string | undefined
    const derniere = (lp ?? []).filter(x => x.employe_id === e.id && x.date_fin).map(x => x.date_fin as string).sort().pop()
    const fin = cert ?? derniere
    if (fin) { const d = jours(e.date_assignation!, fin); if (d >= 0) delais.push(d) }
  }
  const delaiMoyenJours = delais.length ? Math.round((delais.reduce((s, d) => s + d, 0) / delais.length) * 10) / 10 : null

  // Questionnaire
  let questionnaire: StatistiquesFormation['questionnaire'] = null
  const { data: q } = await sb.from('questionnaires').select('id').eq('formation_id', formationId).eq('actif', true).maybeSingle()
  if (q) {
    let tq = sb.from('tentatives_questionnaire').select('employe_id, numero_tentative, note_obtenue, note_maximale, reussi, date_debut, date_fin, reponses_donnees').eq('questionnaire_id', q.id)
    if (portee) tq = tq.in('employe_id', portee.length ? portee : ['00000000-0000-0000-0000-000000000000'])
    const [{ data: tent }, { data: qs }] = await Promise.all([
      tq,
      sb.from('questions').select('id, texte, ordre, reponses_possibles(id, est_correcte)').eq('questionnaire_id', q.id).order('ordre'),
    ])
    const t = tent ?? []
    const employesT = new Set(t.map(x => x.employe_id))
    const reussisSet = new Set(t.filter(x => x.reussi).map(x => x.employe_id))
    const scores = t.filter(x => Number(x.note_maximale) > 0).map(x => (Number(x.note_obtenue) / Number(x.note_maximale)) * 100)
    const durees = t.filter(x => x.date_debut && x.date_fin).map(x => (Date.parse(x.date_fin) - Date.parse(x.date_debut)) / 60000).filter(m => m > 0 && m < 240)
    questionnaire = {
      tentatives: t.length,
      employes: employesT.size,
      reussis: reussisSet.size,
      premierEssai: pct(t.filter(x => x.numero_tentative === 1 && x.reussi).length, t.filter(x => x.numero_tentative === 1).length),
      scoreMoyen: scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : null,
      dureeMoyenneMin: durees.length ? Math.round((durees.reduce((s, v) => s + v, 0) / durees.length) * 10) / 10 : null,
      questions: reussiteParQuestion(
        (qs ?? []).map(x => ({ id: x.id as string, texte: x.texte as string, bonne: ((x.reponses_possibles ?? []) as { id: string; est_correcte: boolean }[]).find(r => r.est_correcte)?.id ?? null })),
        t.map(x => ({ reponses: lireReponses(x.reponses_donnees) })),
      ),
    }
  }

  // Par département
  const parDep = new Map<string, { assignes: number; termines: number }>()
  for (const e of employes) {
    const d = parDep.get(e.departement) ?? { assignes: 0, termines: 0 }
    d.assignes++; if (estComplete(e.statut)) d.termines++
    parDep.set(e.departement, d)
  }
  const departements = Array.from(parDep.entries()).map(([nom, d]) => ({ nom, ...d, taux: pct(d.termines, d.assignes) })).sort((a, b) => a.taux - b.taux)

  // Satisfaction
  let sondage: ResultatsSondage | null = null
  if (await sondagesDisponibles(sb)) {
    const rep = await chargerReponses(sb, [formationId], portee)
    if (rep.length) sondage = agregerReponses(formationId, rep)
  }

  return { totaux, delaiMoyenJours, lecons: statLecons, questionnaire, departements, sondage, employes }
}
