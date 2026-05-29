'use server'

import { createClient } from '@/lib/supabase/server'
import type { Lesson, ContentBlock, ContentBlockType, LessonAvecBlocs } from '@/lib/types/formation'
import type { ActionResult } from './formations'

async function checkAdminRole(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase.from('employes').select('role').eq('auth_user_id', userId).single()
  return !!data && ['admin', 'gestionnaire'].includes(data.role)
}

export async function getLessonsWithBlocks(moduleId: string): Promise<ActionResult<LessonAvecBlocs[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifie' }
  const { data, error } = await supabase.from('lessons').select('*, content_blocks (*)').eq('module_id', moduleId).order('ordre', { ascending: true }).order('ordre', { referencedTable: 'content_blocks', ascending: true })
  if (error) return { success: false, error: error.message }
  return { success: true, data: data as LessonAvecBlocs[] }
}

export async function getLessonWithBlocks(lessonId: string): Promise<ActionResult<LessonAvecBlocs>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifie' }
  const { data, error } = await supabase.from('lessons').select('*, content_blocks (*)').eq('id', lessonId).order('ordre', { referencedTable: 'content_blocks', ascending: true }).single()
  if (error) return { success: false, error: error.message }
  return { success: true, data: data as LessonAvecBlocs }
}

export async function createLesson(payload: { module_id: string; titre: string; description?: string; ordre: number; duree_minutes?: number; est_obligatoire?: boolean }): Promise<ActionResult<Lesson>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifie' }
  if (!await checkAdminRole(supabase, user.id)) return { success: false, error: 'Permission refusee' }
  const { data, error } = await supabase.from('lessons').insert({ est_obligatoire: true, ...payload }).select().single()
  if (error) return { success: false, error: error.message }
  return { success: true, data: data as Lesson }
}

export async function updateLesson(lessonId: string, payload: Partial<{ titre: string; description: string; ordre: number; duree_minutes: number; est_obligatoire: boolean }>): Promise<ActionResult<Lesson>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifie' }
  if (!await checkAdminRole(supabase, user.id)) return { success: false, error: 'Permission refusee' }
  const { data, error } = await supabase.from('lessons').update(payload).eq('id', lessonId).select().single()
  if (error) return { success: false, error: error.message }
  return { success: true, data: data as Lesson }
}

export async function deleteLesson(lessonId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifie' }
  if (!await checkAdminRole(supabase, user.id)) return { success: false, error: 'Permission refusee' }
  const { error } = await supabase.from('lessons').delete().eq('id', lessonId)
  if (error) return { success: false, error: error.message }
  return { success: true, data: undefined }
}

export async function reorderLessons(updates: { id: string; ordre: number }[]): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifie' }
  if (!await checkAdminRole(supabase, user.id)) return { success: false, error: 'Permission refusee' }
  const results = await Promise.all(updates.map(({ id, ordre }) => supabase.from('lessons').update({ ordre }).eq('id', id)))
  const failed = results.find(r => r.error)
  if (failed?.error) return { success: false, error: failed.error.message }
  return { success: true, data: undefined }
}

export async function createContentBlock(payload: { lesson_id: string; type: ContentBlockType; ordre: number; titre?: string; contenu?: string; url?: string; metadata?: Record<string, unknown>; est_requis?: boolean }): Promise<ActionResult<ContentBlock>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifie' }
  if (!await checkAdminRole(supabase, user.id)) return { success: false, error: 'Permission refusee' }
  const { data, error } = await supabase.from('content_blocks').insert({ est_requis: false, ...payload }).select().single()
  if (error) return { success: false, error: error.message }
  return { success: true, data: data as ContentBlock }
}

export async function updateContentBlock(blockId: string, payload: Partial<{ type: ContentBlockType; ordre: number; titre: string; contenu: string; url: string; metadata: Record<string, unknown>; est_requis: boolean }>): Promise<ActionResult<ContentBlock>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifie' }
  if (!await checkAdminRole(supabase, user.id)) return { success: false, error: 'Permission refusee' }
  const { data, error } = await supabase.from('content_blocks').update(payload).eq('id', blockId).select().single()
  if (error) return { success: false, error: error.message }
  return { success: true, data: data as ContentBlock }
}

export async function deleteContentBlock(blockId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifie' }
  if (!await checkAdminRole(supabase, user.id)) return { success: false, error: 'Permission refusee' }
  const { error } = await supabase.from('content_blocks').delete().eq('id', blockId)
  if (error) return { success: false, error: error.message }
  return { success: true, data: undefined }
}

export async function reorderContentBlocks(updates: { id: string; ordre: number }[]): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifie' }
  if (!await checkAdminRole(supabase, user.id)) return { success: false, error: 'Permission refusee' }
  const results = await Promise.all(updates.map(({ id, ordre }) => supabase.from('content_blocks').update({ ordre }).eq('id', id)))
  const failed = results.find(r => r.error)
  if (failed?.error) return { success: false, error: failed.error.message }
  return { success: true, data: undefined }
}

export async function duplicateLesson(lessonId: string, targetModuleId: string): Promise<ActionResult<Lesson>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifie' }
  if (!await checkAdminRole(supabase, user.id)) return { success: false, error: 'Permission refusee' }
  const { data: source, error: fetchErr } = await supabase.from('lessons').select('*, content_blocks (*)').eq('id', lessonId).single()
  if (fetchErr || !source) return { success: false, error: fetchErr?.message ?? 'Lecon introuvable' }
  const { count } = await supabase.from('lessons').select('id', { count: 'exact', head: true }).eq('module_id', targetModuleId)
  const { data: newLesson, error: insertErr } = await supabase.from('lessons').insert({ module_id: targetModuleId, titre: source.titre + ' (copie)', description: source.description, ordre: (count ?? 0) + 1, duree_minutes: source.duree_minutes, est_obligatoire: source.est_obligatoire }).select().single()
  if (insertErr || !newLesson) return { success: false, error: insertErr?.message ?? 'Erreur creation' }
  if (source.content_blocks?.length > 0) {
    const blocks = source.content_blocks.map((b: ContentBlock) => ({ lesson_id: newLesson.id, type: b.type, ordre: b.ordre, titre: b.titre, contenu: b.contenu, url: b.url, metadata: b.metadata, est_requis: b.est_requis }))
    await supabase.from('content_blocks').insert(blocks)
  }
  return { success: true, data: newLesson as Lesson }
}
