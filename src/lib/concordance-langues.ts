// Concordance FR / EN : compare automatiquement la structure d'une formation française et de sa version anglaise
// (leçons, blocs, images, nombre d'éléments, bonnes réponses des quiz, des mises en situation et du questionnaire final).
// Ne juge pas la traduction elle-même, seulement la structure. Côté serveur.
import type { SupabaseClient } from '@supabase/supabase-js'

/** Signature d'un bloc : ce qui doit être identique entre les deux langues. */
export type SignatureBloc = { type: string; genre: string | null; image: string | null; elements: Record<string, number>; reponses: string | null }
export type SignatureLecon = { blocs: SignatureBloc[] }
export type SignatureFormation = { lecons: SignatureLecon[]; questionnaire: string[]; modifiee_le: string | null }

export type Ecart =
  | { quoi: 'lecons'; fr: number; en: number }
  | { quoi: 'blocs'; lecon: number; fr: number; en: number }
  | { quoi: 'type'; lecon: number; bloc: number; fr: string; en: string }
  | { quoi: 'image'; lecon: number; bloc: number }
  | { quoi: 'elements'; lecon: number; bloc: number; cle: string; fr: number; en: number }
  | { quoi: 'reponses'; lecon: number; bloc: number }
  | { quoi: 'questions'; fr: number; en: number }
  | { quoi: 'question'; question: number }

export type Concordance = { ecarts: Ecart[]; fr_modifiee_apres: boolean; fr_modifiee_le: string | null; en_modifiee_le: string | null }

const TYPES_IMAGE = new Set(['image', 'video', 'audio', 'pdf', 'fichier'])

/** Motif des bonnes réponses / catégories, indépendant de la langue : « 0,2|1 » etc. */
function motif(meta: Record<string, unknown>, contenu: unknown, type: string): string | null {
  const parts: string[] = []
  if (type === 'quiz' && typeof contenu === 'string') {
    try {
      const q = JSON.parse(contenu) as { questions?: { reponses?: unknown[]; bonne_reponse?: unknown }[] }
      for (const x of q.questions ?? []) parts.push(`${(x.reponses ?? []).length}/${JSON.stringify(x.bonne_reponse ?? null)}`)
    } catch { parts.push('?') }
  }
  const sc = meta.scenario
  if (Array.isArray(sc)) for (const s of sc as { choix?: { bon?: unknown }[] }[]) parts.push((s.choix ?? []).map(c => (c.bon ? '1' : '0')).join(''))
  const paires = meta.paires
  if (Array.isArray(paires)) {
    // Catégories traduites : on compare le motif (1re catégorie vue = 0, 2e = 1…)
    const vues: string[] = []
    parts.push((paires as { categorie?: unknown }[]).map(p => { const c = String(p.categorie ?? ''); if (!vues.includes(c)) vues.push(c); return vues.indexOf(c) }).join(''))
  }
  return parts.length ? parts.join('|') : null
}

/** Signature d'un bloc (fonction pure). */
export function signatureBloc(b: { type: string; url?: string | null; contenu?: unknown; metadata?: unknown }): SignatureBloc {
  const meta = (b.metadata && typeof b.metadata === 'object' ? b.metadata : {}) as Record<string, unknown>
  const elements: Record<string, number> = {}
  for (const [k, v] of Object.entries(meta)) if (Array.isArray(v)) elements[k] = v.length
  if (b.type === 'quiz' && typeof b.contenu === 'string') {
    try { elements.questions = ((JSON.parse(b.contenu) as { questions?: unknown[] }).questions ?? []).length } catch { /* contenu libre */ }
  }
  return {
    type: b.type, genre: typeof meta.genre === 'string' ? meta.genre : null,
    image: TYPES_IMAGE.has(b.type) ? (b.url ?? null) : null,
    elements, reponses: motif(meta, b.contenu, b.type),
  }
}

/** Compare deux signatures (fonction pure). */
export function comparerSignatures(fr: SignatureFormation, en: SignatureFormation): Concordance {
  const ecarts: Ecart[] = []
  if (fr.lecons.length !== en.lecons.length) ecarts.push({ quoi: 'lecons', fr: fr.lecons.length, en: en.lecons.length })
  const nL = Math.min(fr.lecons.length, en.lecons.length)
  for (let l = 0; l < nL; l++) {
    const a = fr.lecons[l].blocs, b = en.lecons[l].blocs
    if (a.length !== b.length) ecarts.push({ quoi: 'blocs', lecon: l + 1, fr: a.length, en: b.length })
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const x = a[i], y = b[i], pos = { lecon: l + 1, bloc: i + 1 }
      if (x.type !== y.type || x.genre !== y.genre) { ecarts.push({ quoi: 'type', ...pos, fr: x.genre ?? x.type, en: y.genre ?? y.type }); continue }
      if (x.image !== y.image) ecarts.push({ quoi: 'image', ...pos })
      for (const cle of Array.from(new Set([...Object.keys(x.elements), ...Object.keys(y.elements)]))) {
        const nf = x.elements[cle] ?? 0, ne = y.elements[cle] ?? 0
        if (nf !== ne) ecarts.push({ quoi: 'elements', ...pos, cle, fr: nf, en: ne })
      }
      if (x.reponses !== y.reponses && Object.keys(x.elements).every(k => x.elements[k] === y.elements[k])) ecarts.push({ quoi: 'reponses', ...pos })
    }
  }
  if (fr.questionnaire.length !== en.questionnaire.length) ecarts.push({ quoi: 'questions', fr: fr.questionnaire.length, en: en.questionnaire.length })
  for (let q = 0; q < Math.min(fr.questionnaire.length, en.questionnaire.length); q++) {
    if (fr.questionnaire[q] !== en.questionnaire[q]) ecarts.push({ quoi: 'question', question: q + 1 })
  }
  // FR modifiée après l'EN (marge d'une minute)
  const tf = fr.modifiee_le ? Date.parse(fr.modifiee_le) : NaN, te = en.modifiee_le ? Date.parse(en.modifiee_le) : NaN
  const apres = !isNaN(tf) && !isNaN(te) && tf - te > 60_000
  return { ecarts, fr_modifiee_apres: apres, fr_modifiee_le: fr.modifiee_le, en_modifiee_le: en.modifiee_le }
}

const plusRecent = (a: string | null, b: unknown) => (typeof b === 'string' && (!a || b > a) ? b : a)

/** Signatures de plusieurs formations, chargées en lot. */
export async function chargerSignatures(sb: SupabaseClient, ids: string[]): Promise<Map<string, SignatureFormation>> {
  const res = new Map<string, SignatureFormation>()
  const uniques = Array.from(new Set(ids.filter(Boolean)))
  if (!uniques.length) return res
  const [{ data: fs }, { data: mods }, { data: qz }] = await Promise.all([
    sb.from('formations').select('id, updated_at').in('id', uniques),
    sb.from('modules').select('id, formation_id, ordre').in('formation_id', uniques).order('ordre'),
    sb.from('questionnaires').select('id, formation_id').in('formation_id', uniques),
  ])
  const modIds = (mods ?? []).map(m => m.id as string)
  const { data: lecs } = modIds.length ? await sb.from('lessons').select('id, module_id, ordre, updated_at').in('module_id', modIds).order('ordre') : { data: [] as Record<string, unknown>[] }
  const lecIds = (lecs ?? []).map(l => l.id as string)
  const blocs: Record<string, unknown>[] = []
  for (let i = 0; i < lecIds.length; i += 200) {
    const { data } = await sb.from('content_blocks').select('lesson_id, type, url, contenu, metadata, ordre, updated_at').in('lesson_id', lecIds.slice(i, i + 200)).order('ordre')
    blocs.push(...(data ?? []))
  }
  const qIds = (qz ?? []).map(q => q.id as string)
  const { data: qs } = qIds.length ? await sb.from('questions').select('id, questionnaire_id, ordre').in('questionnaire_id', qIds).order('ordre') : { data: [] as Record<string, unknown>[] }
  const quIds = (qs ?? []).map(q => q.id as string)
  const { data: reps } = quIds.length ? await sb.from('reponses_possibles').select('question_id, est_correcte, ordre').in('question_id', quIds).order('ordre') : { data: [] as Record<string, unknown>[] }

  for (const id of uniques) {
    let modifiee: string | null = ((fs ?? []).find(f => f.id === id)?.updated_at as string) ?? null
    const lecons: SignatureLecon[] = []
    for (const m of (mods ?? []).filter(m => m.formation_id === id)) {
      for (const l of (lecs ?? []).filter(l => l.module_id === m.id)) {
        modifiee = plusRecent(modifiee, l.updated_at)
        const bs = blocs.filter(b => b.lesson_id === l.id)
        for (const b of bs) modifiee = plusRecent(modifiee, b.updated_at)
        lecons.push({ blocs: bs.map(b => signatureBloc(b as { type: string; url?: string | null; contenu?: unknown; metadata?: unknown })) })
      }
    }
    const q = (qz ?? []).find(x => x.formation_id === id)
    const questionnaire = q ? (qs ?? []).filter(x => x.questionnaire_id === q.id).map(x => (reps ?? []).filter(r => r.question_id === x.id).map(r => (r.est_correcte ? '1' : '0')).join('')) : []
    res.set(id, { lecons, questionnaire, modifiee_le: modifiee })
  }
  return res
}

/** Concordance de chaque paire FR → EN donnée (clé : id de la version française). */
export async function concordances(sb: SupabaseClient, paires: { fr: string; en: string }[]): Promise<Map<string, Concordance>> {
  const sig = await chargerSignatures(sb, paires.flatMap(p => [p.fr, p.en]))
  const res = new Map<string, Concordance>()
  for (const p of paires) {
    const a = sig.get(p.fr), b = sig.get(p.en)
    if (a && b) res.set(p.fr, comparerSignatures(a, b))
  }
  return res
}
