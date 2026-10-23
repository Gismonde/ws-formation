// Duplication complète d'une formation (modules, leçons, blocs, questionnaire), en brouillon.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CliniqueContenu } from '@/lib/cliniques'

type Ligne = Record<string, unknown>
const sans = (l: Ligne, ...cles: string[]) => Object.fromEntries(Object.entries(l).filter(([k]) => !cles.includes(k)))
const SYSTEME = ['id', 'created_at', 'updated_at', 'origine_id', 'copie_de']
// La copie repart de zéro : ni validation, ni publication, ni versions
const VALIDATION_ET_PUBLICATION = ['statut_validation', 'validateur_id', 'validation_demandee_le', 'validation_demandee_par', 'validation_le', 'validation_commentaire', 'validee_par', 'publiee_le', 'version', 'version_le']

export async function dupliquerFormation(
  sb: SupabaseClient, formationId: string, options: { clinique: CliniqueContenu; titre: string; creePar: string; copieDe?: string },
): Promise<{ id: string; modules: number; lecons: number; blocs: number; questions: number }> {
  const { data: f, error } = await sb.from('formations').select('*').eq('id', formationId).single()
  if (error || !f) throw new Error('Formation introuvable')

  const { data: nouvelle, error: eF } = await sb.from('formations')
    .insert({ ...sans(f, ...SYSTEME, ...VALIDATION_ET_PUBLICATION, 'creee_par'), titre: options.titre, clinique: options.clinique, publiee: false, creee_par: options.creePar, ...(options.copieDe ? { copie_de: options.copieDe } : {}) })
    .select('id').single()
  if (eF || !nouvelle) throw new Error(eF?.message ?? 'Copie impossible')
  const nid = nouvelle.id as string
  // Copie de travail : chaque élément garde l'identifiant de son original (progression des employés conservée à l'application)
  const origine = (id: unknown) => (options.copieDe ? { origine_id: id } : {})
  const bilan = { id: nid, modules: 0, lecons: 0, blocs: 0, questions: 0 }

  try {
    const { data: modules } = await sb.from('modules').select('*').eq('formation_id', formationId).order('ordre')
    for (const m of modules ?? []) {
      const { data: nm, error: eM } = await sb.from('modules').insert({ ...sans(m, ...SYSTEME), ...origine(m.id), formation_id: nid }).select('id').single()
      if (eM || !nm) throw new Error(eM?.message ?? 'Copie d’un module impossible')
      bilan.modules++
      const { data: lecons } = await sb.from('lessons').select('*').eq('module_id', m.id).order('ordre')
      for (const l of lecons ?? []) {
        const { data: nl, error: eL } = await sb.from('lessons').insert({ ...sans(l, ...SYSTEME), ...origine(l.id), module_id: nm.id }).select('id').single()
        if (eL || !nl) throw new Error(eL?.message ?? 'Copie d’une leçon impossible')
        bilan.lecons++
        const { data: blocs } = await sb.from('content_blocks').select('*').eq('lesson_id', l.id).order('ordre')
        if (blocs?.length) {
          const { error: eB } = await sb.from('content_blocks').insert(blocs.map(b => ({ ...sans(b, ...SYSTEME), ...origine(b.id), lesson_id: nl.id })))
          if (eB) throw new Error(eB.message)
          bilan.blocs += blocs.length
        }
      }
    }

    const { data: q } = await sb.from('questionnaires').select('*').eq('formation_id', formationId).eq('actif', true).maybeSingle()
    if (q) {
      const { data: nq, error: eQ } = await sb.from('questionnaires').insert({ ...sans(q, ...SYSTEME), formation_id: nid, titre: options.copieDe ? q.titre : `Questionnaire - ${options.titre}` }).select('id').single()
      if (eQ || !nq) throw new Error(eQ?.message ?? 'Copie du questionnaire impossible')
      const { data: questions } = await sb.from('questions').select('*, reponses_possibles(*)').eq('questionnaire_id', q.id).order('ordre')
      for (const x of questions ?? []) {
        const { reponses_possibles, ...question } = x as Ligne & { reponses_possibles: Ligne[] }
        const { data: nx, error: eX } = await sb.from('questions').insert({ ...sans(question, ...SYSTEME), questionnaire_id: nq.id }).select('id').single()
        if (eX || !nx) throw new Error(eX?.message ?? 'Copie d’une question impossible')
        if (reponses_possibles?.length) {
          const { error: eR } = await sb.from('reponses_possibles').insert(reponses_possibles.map(r => ({ ...sans(r, ...SYSTEME), question_id: nx.id })))
          if (eR) throw new Error(eR.message)
        }
        bilan.questions++
      }
    }
  } catch (e) {
    // Pas de demi-copie : on retire la formation créée (cascade sur ses modules, leçons, blocs, questionnaire)
    await sb.from('formations').delete().eq('id', nid)
    throw e
  }
  return bilan
}
