// Export d'une formation au format de l'import (formation, modules, leçons, blocs, questionnaire).
// Sert à dupliquer, traduire ou archiver une formation. Réservé aux administrateurs de sa clinique.
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, cliniquesContenuGerablesToutes } from '@/lib/permissions'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const a = await getActeur()
  if (!a || (a.role !== 'super_admin' && a.role !== 'admin')) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const sb = serviceClient()
  const { data: f } = await sb.from('formations').select('*').eq('id', id).maybeSingle()
  if (!f) return NextResponse.json({ error: 'Formation introuvable' }, { status: 404 })
  if (!cliniquesContenuGerablesToutes(a).includes((f.clinique ?? 'LES_DEUX') as never)) return NextResponse.json({ error: 'Hors de votre périmètre' }, { status: 403 })

  const { data: mods } = await sb.from('modules').select('id, titre, contenu, duree_minutes, ordre').eq('formation_id', id).order('ordre')
  const modIds = (mods ?? []).map(m => m.id)
  const { data: lecs } = modIds.length ? await sb.from('lessons').select('*').in('module_id', modIds).order('ordre') : { data: [] as Record<string, unknown>[] }
  const lecIds = (lecs ?? []).map(l => l.id as string)
  const { data: blocs } = lecIds.length ? await sb.from('content_blocks').select('lesson_id, type, titre, contenu, url, metadata, ordre').in('lesson_id', lecIds).order('ordre') : { data: [] as Record<string, unknown>[] }
  const { data: qz } = await sb.from('questionnaires').select('id, titre, note_passage').eq('formation_id', id).limit(1).maybeSingle()
  const { data: qs } = qz ? await sb.from('questions').select('id, texte, ordre').eq('questionnaire_id', qz.id).order('ordre') : { data: [] as { id: string; texte: string; ordre: number }[] }
  const { data: reps } = (qs ?? []).length ? await sb.from('reponses_possibles').select('question_id, texte, est_correcte, ordre').in('question_id', (qs ?? []).map(q => q.id)).order('ordre') : { data: [] as { question_id: string; texte: string; est_correcte: boolean; ordre: number }[] }

  const sansNull = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== ''))
  return NextResponse.json({
    titre: f.titre, description: f.description, clinique: f.clinique, categorie: f.categorie, niveau: f.niveau,
    duree_minutes: f.duree_estimee_minutes, objectifs: f.objectifs ?? [], tags: f.tags ?? [], image_couverture: f.image_couverture,
    validite_mois: f.validite_mois ?? null, mode_presentation: f.mode_presentation ?? null, audio_auto: f.audio_auto ?? false,
    modules: (mods ?? []).map(m => ({
      titre: m.titre, contenu: m.contenu, duree_minutes: m.duree_minutes,
      lecons: (lecs ?? []).filter(l => l.module_id === m.id).map(l => ({
        ...sansNull({ titre: l.titre, description: l.description, duree_minutes: l.duree_minutes, texte_attestation: l.texte_attestation }),
        ...(l.attestation_requise ? { attestation_requise: true } : {}), ...(l.apparition_progressive ? { apparition_progressive: true } : {}),
        blocs: (blocs ?? []).filter(b => b.lesson_id === l.id).map(b => sansNull({ type: b.type, titre: b.titre, contenu: b.contenu, url: b.url, metadata: b.metadata })),
      })),
    })),
    questionnaire: qz ? {
      titre: qz.titre, note_passage: qz.note_passage,
      questions: (qs ?? []).map(q => ({ texte: q.texte, reponses: (reps ?? []).filter(r => r.question_id === q.id).map(r => ({ texte: r.texte, est_correcte: r.est_correcte })) })),
    } : null,
  })
}
