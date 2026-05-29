'use server'

import { createClient } from '@/lib/supabase/server'
import type { LessonProgression, Progression, ProgressionResume } from '@/lib/types/formation'
import type { ActionResult } from './formations'

// =====================================================
// PROGRESSION PAR LECON
// =====================================================

export async function upsertLessonProgression(payload: {
  lesson_id: string
  statut: 'non_commence' | 'en_cours' | 'termine'
  pourcentage_complete?: number
}): Promise<ActionResult<LessonProgression>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifie' }

  const { data: employe } = await supabase
    .from('employes')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (!employe) return { success: false, error: 'Employe introuvable' }

  const now = new Date().toISOString()
  const update: Record<string, unknown> = {
    employe_id: employe.id,
    lesson_id: payload.lesson_id,
    statut: payload.statut,
    pourcentage_complete: payload.pourcentage_complete ?? 0,
  }

  if (payload.statut === 'en_cours' || payload.statut === 'termine') {
    update.date_debut = update.date_debut ?? now
  }
  if (payload.statut === 'termine') {
    update.date_fin = now
    update.pourcentage_complete = 100
  }

  const { data, error } = await supabase
    .from('lesson_progressions')
    .upsert(update, { onConflict: 'employe_id,lesson_id' })
    .select()
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, data: data as LessonProgression }
}

export async function getLessonProgressions(lessonId: string): Promise<ActionResult<LessonProgression[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifie' }

  const { data, error } = await supabase
    .from('lesson_progressions')
    .select('*')
    .eq('lesson_id', lessonId)

  if (error) return { success: false, error: error.message }
  return { success: true, data: data as LessonProgression[] }
}

export async function getMyLessonProgressions(moduleId: string): Promise<ActionResult<LessonProgression[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifie' }

  const { data: employe } = await supabase
    .from('employes')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (!employe) return { success: false, error: 'Employe introuvable' }

  const { data, error } = await supabase
    .from('lesson_progressions')
    .select('*, lessons!inner(module_id)')
    .eq('employe_id', employe.id)
    .eq('lessons.module_id', moduleId)

  if (error) return { success: false, error: error.message }
  return { success: true, data: data as LessonProgression[] }
}

// =====================================================
// PROGRESSION PAR MODULE (table existante)
// =====================================================

export async function upsertModuleProgression(payload: {
  module_id: string
  statut: 'non_commence' | 'en_cours' | 'termine'
  pourcentage_complete?: number
}): Promise<ActionResult<Progression>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifie' }

  const { data: employe } = await supabase
    .from('employes')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (!employe) return { success: false, error: 'Employe introuvable' }

  const now = new Date().toISOString()
  const update: Record<string, unknown> = {
    employe_id: employe.id,
    module_id: payload.module_id,
    statut: payload.statut,
    pourcentage_complete: payload.pourcentage_complete ?? 0,
  }

  if (payload.statut === 'termine') {
    update.date_fin = now
    update.pourcentage_complete = 100
  }

  const { data, error } = await supabase
    .from('progressions')
    .upsert(update, { onConflict: 'employe_id,module_id' })
    .select()
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, data: data as Progression }
}

// =====================================================
// CALCUL AUTO DE LA PROGRESSION MODULE
// Appellee apres chaque upsert de lesson_progression
// =====================================================

export async function syncModuleProgression(moduleId: string): Promise<ActionResult<Progression>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifie' }

  const { data: employe } = await supabase
    .from('employes')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (!employe) return { success: false, error: 'Employe introuvable' }

  // Compter les lecons du module
  const { count: totalLessons } = await supabase
    .from('lessons')
    .select('id', { count: 'exact', head: true })
    .eq('module_id', moduleId)
    .eq('est_obligatoire', true)

  if (!totalLessons) {
    return upsertModuleProgression({ module_id: moduleId, statut: 'non_commence', pourcentage_complete: 0 })
  }

  // Compter les lecons terminees
  const { count: completedLessons } = await supabase
    .from('lesson_progressions')
    .select('id', { count: 'exact', head: true })
    .eq('employe_id', employe.id)
    .eq('statut', 'termine')
    .in('lesson_id',
      supabase.from('lessons').select('id').eq('module_id', moduleId).eq('est_obligatoire', true)
    )

  const pct = Math.round(((completedLessons ?? 0) / totalLessons) * 100)
  const statut = pct === 0 ? 'non_commence' : pct === 100 ? 'termine' : 'en_cours'

  return upsertModuleProgression({
    module_id: moduleId,
    statut,
    pourcentage_complete: pct,
  })
}

// =====================================================
// RESUME GLOBAL POUR L'EMPLOYE
// =====================================================

export async function getProgressionResume(formationId: string): Promise<ActionResult<ProgressionResume>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifie' }

  const { data: employe } = await supabase
    .from('employes')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (!employe) return { success: false, error: 'Employe introuvable' }

  const { data: formation } = await supabase
    .from('formations')
    .select('id, titre')
    .eq('id', formationId)
    .single()

  if (!formation) return { success: false, error: 'Formation introuvable' }

  const { data: modules } = await supabase
    .from('modules')
    .select('id')
    .eq('formation_id', formationId)

  const moduleIds = (modules ?? []).map((m: { id: string }) => m.id)
  const totalModules = moduleIds.length

  const { count: modulesTermines } = await supabase
    .from('progressions')
    .select('id', { count: 'exact', head: true })
    .eq('employe_id', employe.id)
    .eq('statut', 'termine')
    .in('module_id', moduleIds)

  const { count: totalLessons } = await supabase
    .from('lessons')
    .select('id', { count: 'exact', head: true })
    .in('module_id', moduleIds)

  const { count: lessonsTerminees } = await supabase
    .from('lesson_progressions')
    .select('id', { count: 'exact', head: true })
    .eq('employe_id', employe.id)
    .eq('statut', 'termine')
    .in('lesson_id',
      supabase.from('lessons').select('id').in('module_id', moduleIds)
    )

  const pctGlobal = totalLessons
    ? Math.round(((lessonsTerminees ?? 0) / totalLessons) * 100)
    : 0

  return {
    success: true,
    data: {
      formation_id: formationId,
      formation_titre: formation.titre,
      total_modules: totalModules,
      modules_termines: modulesTermines ?? 0,
      total_lessons: totalLessons ?? 0,
      lessons_terminees: lessonsTerminees ?? 0,
      pourcentage_global: pctGlobal,
    },
  }
}
