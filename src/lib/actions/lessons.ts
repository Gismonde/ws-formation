'use server'

import { createClient } from '@/lib/supabase/server'
import { getCreateurFormations } from '@/lib/permissions'
import type { Lesson, ContentBlock, ContentBlockType, LessonAvecBlocs } from '@/lib/types/formation'
import type { ActionResult } from './formations'

// Les blocs sont renvoyés sous la clé « blocs », triés par ordre
function trierBlocs<T extends { blocs?: { ordre: number }[] | null }>(l: T): T {
  return { ...l, blocs: [...(l.blocs ?? [])].sort((a, b) => a.ordre - b.ordre) }
}

export async function getLessonsWithBlocks(moduleId: string): Promise<ActionResult<LessonAvecBlocs[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifié' }
  const { data, error } = await supabase.from('lessons').select('*, blocs:content_blocks (*)').eq('module_id', moduleId).order('ordre', { ascending: true })
  if (error) return { success: false, error: error.message }
  return { success: true, data: (data ?? []).map(trierBlocs) as LessonAvecBlocs[] }
}

export async function getLessonWithBlocks(lessonId: string): Promise<ActionResult<LessonAvecBlocs>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifié' }
  const { data, error } = await supabase.from('lessons').select('*, blocs:content_blocks (*)').eq('id', lessonId).single()
  if (error) return { success: false, error: error.message }
  return { success: true, data: trierBlocs(data) as LessonAvecBlocs }
}

export async function createLesson(payload: { module_id: string; titre: string; description?: string; ordre?: number; duree_minutes?: number; obligatoire?: boolean }): Promise<ActionResult<Lesson>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifié' }
  if (!await getCreateurFormations()) return { success: false, error: 'Non autorisé : création de formations non permise' }
  const { data, error } = await supabase.from('lessons').insert(payload).select().single()
  if (error) return { success: false, error: error.message }
  return { success: true, data: data as Lesson }
}

export async function updateLesson(lessonId: string, payload: Partial<{ titre: string; description: string; ordre: number; duree_minutes: number; obligatoire: boolean; attestation_requise: boolean; texte_attestation: string | null }>): Promise<ActionResult<Lesson>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifié' }
  if (!await getCreateurFormations()) return { success: false, error: 'Non autorisé : création de formations non permise' }
  const { data, error } = await supabase.from('lessons').update(payload).eq('id', lessonId).select().single()
  if (error) return { success: false, error: error.message }
  return { success: true, data: data as Lesson }
}

export async function deleteLesson(lessonId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifié' }
  if (!await getCreateurFormations()) return { success: false, error: 'Non autorisé : création de formations non permise' }
  const { error } = await supabase.from('lessons').delete().eq('id', lessonId)
  if (error) return { success: false, error: error.message }
  return { success: true, data: undefined }
}

export async function reorderLessons(moduleId: string, ordre: { id: string; ordre: number }[]): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifié' }
  if (!await getCreateurFormations()) return { success: false, error: 'Non autorisé : création de formations non permise' }
  await Promise.all(ordre.map(({ id, ordre: o }) =>
    supabase.from('lessons').update({ ordre: o }).eq('id', id).eq('module_id', moduleId)
  ))
  return { success: true, data: undefined }
}

export async function createContentBlock(payload: { lesson_id: string; type: ContentBlockType; titre?: string; contenu?: string; url?: string; ordre?: number; metadata?: Record<string, unknown> | null }): Promise<ActionResult<ContentBlock>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifié' }
  if (!await getCreateurFormations()) return { success: false, error: 'Non autorisé : création de formations non permise' }
  const { data, error } = await supabase.from('content_blocks').insert(payload).select().single()
  if (error) return { success: false, error: error.message }
  return { success: true, data: data as ContentBlock }
}

export async function updateContentBlock(blocId: string, payload: Partial<{ titre: string | null; contenu: string | null; url: string | null; ordre: number; metadata: Record<string, unknown> | null }>): Promise<ActionResult<ContentBlock>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifié' }
  if (!await getCreateurFormations()) return { success: false, error: 'Non autorisé : création de formations non permise' }
  const { data, error } = await supabase.from('content_blocks').update(payload).eq('id', blocId).select().single()
  if (error) return { success: false, error: error.message }
  return { success: true, data: data as ContentBlock }
}

export async function deleteContentBlock(blocId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifié' }
  if (!await getCreateurFormations()) return { success: false, error: 'Non autorisé : création de formations non permise' }
  const { error } = await supabase.from('content_blocks').delete().eq('id', blocId)
  if (error) return { success: false, error: error.message }
  return { success: true, data: undefined }
}

export async function reorderContentBlocks(lessonId: string, ordre: { id: string; ordre: number }[]): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifié' }
  if (!await getCreateurFormations()) return { success: false, error: 'Non autorisé : création de formations non permise' }
  await Promise.all(ordre.map(({ id, ordre: o }) =>
    supabase.from('content_blocks').update({ ordre: o }).eq('id', id).eq('lesson_id', lessonId)
  ))
  return { success: true, data: undefined }
}
