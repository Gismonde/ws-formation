'use server'

import { createClient } from '@/lib/supabase/server'
import type { Formation, Module, FormationComplete } from '@/lib/types/formation'

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

export async function getFormations(): Promise<ActionResult<Formation[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifie' }
  const { data, error } = await supabase.from('formations').select('*').order('created_at', { ascending: false })
  if (error) return { success: false, error: error.message }
  return { success: true, data: data as Formation[] }
}

export async function getFormationWithModules(formationId: string): Promise<ActionResult<FormationComplete>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifie' }
  const { data, error } = await supabase
    .from('formations')
    .select('*, modules(*)')
    .eq('id', formationId)
    .order('ordre', { referencedTable: 'modules', ascending: true })
    .single()
  if (error) return { success: false, error: error.message }
  return { success: true, data: data as FormationComplete }
}

export async function createFormation(payload: {
  titre: string
  description?: string
  categorie?: string
  niveau?: string
  duree_estimee_minutes?: number
}): Promise<ActionResult<Formation>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifie' }
  const { data: emp } = await supabase.from('employes').select('role').eq('auth_user_id', user.id).single()
  if (!emp || !['admin', 'gestionnaire'].includes(emp.role)) return { success: false, error: 'Non autorise' }
  const { data, error } = await supabase.from('formations').insert({ ...payload, publiee: false }).select().single()
  if (error) return { success: false, error: error.message }
  return { success: true, data: data as Formation }
}

export async function updateFormation(
  formationId: string,
  payload: Partial<{ titre: string; description: string; categorie: string; niveau: string; duree_estimee_minutes: number; publiee: boolean }>
): Promise<ActionResult<Formation>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifie' }
  const { data: emp } = await supabase.from('employes').select('role').eq('auth_user_id', user.id).single()
  if (!emp || !['admin', 'gestionnaire'].includes(emp.role)) return { success: false, error: 'Non autorise' }
  const { data, error } = await supabase.from('formations').update(payload).eq('id', formationId).select().single()
  if (error) return { success: false, error: error.message }
  return { success: true, data: data as Formation }
}

export async function togglePublierFormation(formationId: string, publiee: boolean): Promise<ActionResult> {
  return updateFormation(formationId, { publiee })
}

export async function deleteFormation(formationId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifie' }
  const { data: emp } = await supabase.from('employes').select('role').eq('auth_user_id', user.id).single()
  if (!emp || emp.role !== 'admin') return { success: false, error: 'Non autorise - admin requis' }
  const { error } = await supabase.from('formations').delete().eq('id', formationId)
  if (error) return { success: false, error: error.message }
  return { success: true, data: undefined }
}

export async function createModule(payload: {
  formation_id: string
  titre: string
  description?: string
  ordre?: number
  duree_minutes?: number
}): Promise<ActionResult<Module>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifie' }
  const { data: emp } = await supabase.from('employes').select('role').eq('auth_user_id', user.id).single()
  if (!emp || !['admin', 'gestionnaire'].includes(emp.role)) return { success: false, error: 'Non autorise' }
  const { data, error } = await supabase.from('modules').insert(payload).select().single()
  if (error) return { success: false, error: error.message }
  return { success: true, data: data as Module }
}

export async function updateModule(
  moduleId: string,
  payload: Partial<{ titre: string; description: string; ordre: number; duree_minutes: number }>
): Promise<ActionResult<Module>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifie' }
  const { data: emp } = await supabase.from('employes').select('role').eq('auth_user_id', user.id).single()
  if (!emp || !['admin', 'gestionnaire'].includes(emp.role)) return { success: false, error: 'Non autorise' }
  const { data, error } = await supabase.from('modules').update(payload).eq('id', moduleId).select().single()
  if (error) return { success: false, error: error.message }
  return { success: true, data: data as Module }
}

export async function deleteModule(moduleId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifie' }
  const { data: emp } = await supabase.from('employes').select('role').eq('auth_user_id', user.id).single()
  if (!emp || !['admin', 'gestionnaire'].includes(emp.role)) return { success: false, error: 'Non autorise' }
  const { error } = await supabase.from('modules').delete().eq('id', moduleId)
  if (error) return { success: false, error: error.message }
  return { success: true, data: undefined }
}

export async function reorderModules(
  formationId: string,
  ordre: { id: string; ordre: number }[]
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifie' }
  const { data: emp } = await supabase.from('employes').select('role').eq('auth_user_id', user.id).single()
  if (!emp || !['admin', 'gestionnaire'].includes(emp.role)) return { success: false, error: 'Non autorise' }
  await Promise.all(ordre.map(({ id, ordre: o }) =>
    supabase.from('modules').update({ ordre: o }).eq('id', id).eq('formation_id', formationId)
  ))
  return { success: true, data: undefined }
}
