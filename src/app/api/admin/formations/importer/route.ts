// Import d'une formation complète (formation, modules, leçons, blocs, questionnaire) à partir d'un JSON.
// Réservé aux administrateurs. La formation est créée en brouillon.
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, peutGererContenu } from '@/lib/permissions'
import { estCliniqueContenu } from '@/lib/cliniques'
import { logAudit } from '@/lib/audit'

const TYPES_BLOCS = ['text', 'image', 'video', 'file', 'slide', 'quiz', 'interactif']
const txt = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

type Bloc = { type: string; titre?: string; contenu?: string; url?: string; metadata?: Record<string, unknown> }
type Lecon = { titre: string; description?: string; duree_minutes?: number; attestation_requise?: boolean; texte_attestation?: string; apparition_progressive?: boolean; blocs?: Bloc[] }
type Module = { titre: string; contenu?: string; duree_minutes?: number; lecons?: Lecon[] }
type Question = { texte: string; reponses: { texte: string; est_correcte: boolean }[] }

export async function POST(req: Request) {
  const a = await getActeur()
  if (!a || (a.role !== 'super_admin' && a.role !== 'admin')) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const c = await req.json().catch(() => null)
  if (!c || !txt(c.titre, 300)) return NextResponse.json({ error: 'Titre requis' }, { status: 400 })
  if (!estCliniqueContenu(c.clinique) || !peutGererContenu(a, c.clinique)) return NextResponse.json({ error: 'Clinique invalide ou hors de votre périmètre' }, { status: 403 })
  const modules = (Array.isArray(c.modules) ? c.modules : []) as Module[]
  if (!modules.length) return NextResponse.json({ error: 'Au moins un module' }, { status: 400 })
  for (const m of modules) for (const l of m.lecons ?? []) for (const b of l.blocs ?? []) {
    if (!TYPES_BLOCS.includes(b.type)) return NextResponse.json({ error: `Type de bloc inconnu : ${b.type}` }, { status: 400 })
  }

  const sb = serviceClient()
  const base: Record<string, unknown> = {
    titre: txt(c.titre, 300), description: txt(c.description, 4000) || null, categorie: txt(c.categorie, 80) || 'Formation',
    niveau: ['debutant', 'intermediaire', 'avance'].includes(c.niveau) ? c.niveau : 'debutant', clinique: c.clinique,
    duree_estimee_minutes: Number(c.duree_minutes) || 60, publiee: false,
    tags: Array.isArray(c.tags) ? c.tags.slice(0, 20).map(String) : [],
    objectifs: Array.isArray(c.objectifs) ? c.objectifs.slice(0, 12).map(String) : [],
    image_couverture: txt(c.image_couverture, 1000) || null, creee_par: a.id,
  }
  let { data: f, error } = await sb.from('formations').insert({ ...base, delivre_certificat: true }).select('id').single()
  if (error && /delivre_certificat/.test(error.message)) ({ data: f, error } = await sb.from('formations').insert(base).select('id').single())
  if (error || !f) return NextResponse.json({ error: error?.message ?? 'Création impossible' }, { status: 500 })

  const nettoyer = async (msg: string) => { await sb.from('formations').delete().eq('id', f!.id); return NextResponse.json({ error: msg }, { status: 500 }) }
  let nbLecons = 0, nbBlocs = 0
  for (let i = 0; i < modules.length; i++) {
    const m = modules[i]
    const { data: mod, error: em } = await sb.from('modules').insert({ formation_id: f.id, titre: txt(m.titre, 300) || `Module ${i + 1}`, contenu: txt(m.contenu, 4000), duree_minutes: Number(m.duree_minutes) || 15, ordre: i + 1 }).select('id').single()
    if (em || !mod) return nettoyer(em?.message ?? 'Module')
    const lecons = m.lecons ?? []
    for (let j = 0; j < lecons.length; j++) {
      const l = lecons[j]
      const { data: lec, error: el } = await sb.from('lessons').insert({
        module_id: mod.id, titre: txt(l.titre, 300) || `Leçon ${j + 1}`, description: txt(l.description, 2000) || null, ordre: j + 1,
        duree_minutes: Number(l.duree_minutes) || 5, attestation_requise: l.attestation_requise === true,
        texte_attestation: txt(l.texte_attestation, 2000) || null, apparition_progressive: l.apparition_progressive === true,
      }).select('id').single()
      if (el || !lec) return nettoyer(el?.message ?? 'Leçon')
      nbLecons++
      const blocs = (l.blocs ?? []).map((b, k) => ({
        lesson_id: lec.id, type: b.type, titre: txt(b.titre, 300) || null, contenu: typeof b.contenu === 'string' ? b.contenu.slice(0, 20000) : null,
        url: txt(b.url, 2000) || null, metadata: b.metadata && typeof b.metadata === 'object' ? b.metadata : {}, ordre: k + 1,
      }))
      if (blocs.length) {
        const { error: eb } = await sb.from('content_blocks').insert(blocs)
        if (eb) return nettoyer(eb.message)
        nbBlocs += blocs.length
      }
    }
  }

  const qs = (Array.isArray(c.questionnaire?.questions) ? c.questionnaire.questions : []) as Question[]
  if (qs.length) {
    const { data: q, error: eq } = await sb.from('questionnaires').insert({ formation_id: f.id, titre: txt(c.questionnaire.titre, 300) || 'Questionnaire final', note_passage: Math.min(100, Math.max(1, Number(c.questionnaire.note_passage) || 100)) }).select('id').single()
    if (eq || !q) return nettoyer(eq?.message ?? 'Questionnaire')
    for (let i = 0; i < qs.length; i++) {
      const { data: qu, error: equ } = await sb.from('questions').insert({ questionnaire_id: q.id, texte: txt(qs[i].texte, 1000), type: 'choix_multiple', ordre: i + 1 }).select('id').single()
      if (equ || !qu) return nettoyer(equ?.message ?? 'Question')
      await sb.from('reponses_possibles').insert(qs[i].reponses.map((r, k) => ({ question_id: qu.id, texte: txt(r.texte, 500), est_correcte: r.est_correcte === true, ordre: k + 1 })))
    }
  }
  await logAudit({ acteur_id: a.id, formation_id: f.id, type_action: 'FORMATION_CREEE', description: `Formation importée : « ${base.titre} » (${modules.length} modules, ${nbLecons} leçons, ${nbBlocs} blocs)`, metadata: { historique: true, import: true } })
  return NextResponse.json({ id: f.id, modules: modules.length, lecons: nbLecons, blocs: nbBlocs, questions: qs.length })
}
