'use server'

import { refusModification, refusPourModule } from '@/lib/droits-formation'
import { publicationPermise } from '@/lib/validation-formation'
import { serviceClient, peutGererContenu } from '@/lib/permissions'
import { peutEtrePubliee, type FormationValidation } from '@/lib/validation-formation'
import { noterModification, formationDuModule, formationDeLaLecon, formationDuBloc } from '@/lib/historique-formation'
import { createClient } from '@/lib/supabase/server'
import { getCreateurFormations } from '@/lib/permissions'
import type { Formation, Module, FormationComplete } from '@/lib/types/formation'

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

export async function getFormations(): Promise<ActionResult<Formation[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifié' }
  const { data, error } = await supabase.from('formations').select('*').order('created_at', { ascending: false })
  if (error) return { success: false, error: error.message }
  return { success: true, data: data as Formation[] }
}

export async function getFormationWithModules(formationId: string): Promise<ActionResult<FormationComplete>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifié' }
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
  if (!user) return { success: false, error: 'Non authentifié' }
  if (!await getCreateurFormations()) return { success: false, error: 'Non autorisé : création de formations non permise' }
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
  if (!user) return { success: false, error: 'Non authentifié' }
  const acteur = await getCreateurFormations()
  if (!acteur) return { success: false, error: 'Non autorisé : création de formations non permise' }
  { const refus = await refusModification(acteur, formationId); if (refus) return { success: false, error: refus } }
  // Publication : seulement une formation approuvée par un validateur
  if (payload.publiee === true) {
    const { data: f } = await serviceClient().from('formations').select('*').eq('id', formationId).single()
    if (f?.copie_de) return { success: false, error: 'Une copie de travail ne se publie pas : appliquez-la à la formation publiée.' }
    if (f && !f.publiee && !publicationPermise(acteur, f as FormationValidation)) {
      return { success: false, error: 'Cette formation doit être approuvée par un validateur avant d’être publiée.' }
    }
  }
  const { data, error } = await supabase.from('formations').update(payload).eq('id', formationId).select().single()
  if (error) return { success: false, error: error.message }
  const seulementPublication = 'publiee' in payload && Object.keys(payload).length === 1
  await noterModification(acteur, formationId, seulementPublication ? (payload.publiee ? `Formation publiée` : `Formation repassée en brouillon`) : `Réglages modifiés : ${Object.keys(payload).map(c => LIBELLE_REGLAGE[c] ?? c).join(', ')}`, undefined, { invalider: !seulementPublication })
  return { success: true, data: data as Formation }
}

export async function togglePublierFormation(formationId: string, publiee: boolean): Promise<ActionResult> {
  const res = await updateFormation(formationId, { publiee })
  if (!res.success) return res
  // Première publication : date de publication initiale et version 1
  if (publiee) {
    const acteur = await getCreateurFormations()
    const sb = serviceClient()
    const { data: f } = await sb.from('formations').select('*').eq('id', formationId).single()
    if (f && 'publiee_le' in f && !f.publiee_le) {
      const maintenant = new Date().toISOString()
      await sb.from('formations').update({ publiee_le: maintenant, version: 1, version_le: maintenant }).eq('id', formationId)
      await sb.from('formations_versions').insert({ formation_id: formationId, version: 1, publiee_le: maintenant, note: 'Publication initiale', publiee_par: acteur?.id ?? null })
    }
  }
  return { success: true, data: undefined }
}

/** Publie une nouvelle version d'une formation déjà publiée : version + 1, date de mise à jour et note. */
export async function publierNouvelleVersion(formationId: string, note: string): Promise<ActionResult<{ version: number }>> {
  const acteur = await getCreateurFormations()
  if (!acteur) return { success: false, error: 'Non autorisé : création de formations non permise' }
  { const refus = await refusModification(acteur, formationId); if (refus) return { success: false, error: refus } }
  const sb = serviceClient()
  const { data: f } = await sb.from('formations').select('*').eq('id', formationId).single()
  if (!f) return { success: false, error: 'Formation introuvable' }
  if (!peutGererContenu(acteur, f.clinique)) return { success: false, error: 'Formation hors de votre périmètre' }
  if (!('version' in f)) return { success: false, error: 'Exécutez d’abord supabase/migrations/formations_versions.sql dans Supabase.' }
  if (f.copie_de) return { success: false, error: 'Une copie de travail ne se publie pas : appliquez-la à la formation publiée.' }
  if (!f.publiee_le) return { success: false, error: 'Publiez d’abord la formation.' }
  const texte = note.trim().slice(0, 1000)
  if (!texte) return { success: false, error: 'Décrivez ce qui a changé dans cette version.' }
  if (!publicationPermise(acteur, f as FormationValidation)) return { success: false, error: 'Cette nouvelle version doit être approuvée par un validateur avant d’être publiée.' }
  const version = (Number(f.version) || 1) + 1
  const maintenant = new Date().toISOString()
  const { error } = await sb.from('formations').update({ version, version_le: maintenant, publiee: true }).eq('id', formationId)
  if (error) return { success: false, error: error.message }
  await sb.from('formations_versions').insert({ formation_id: formationId, version, publiee_le: maintenant, note: texte, publiee_par: acteur.id })
  await noterModification(acteur, formationId, `Version ${version} publiée : ${texte}`, undefined, { invalider: false })
  return { success: true, data: { version } }
}

export async function deleteFormation(formationId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifié' }
  const { data: emp } = await supabase.from('employes').select('role').eq('auth_user_id', user.id).single()
  if (!emp || !['super_admin', 'admin'].includes(emp.role)) return { success: false, error: 'Non autorise - admin requis' }
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
  if (!user) return { success: false, error: 'Non authentifié' }
  const acteur = await getCreateurFormations()
  if (!acteur) return { success: false, error: 'Non autorisé : création de formations non permise' }
  { const refus = await refusModification(acteur, payload.formation_id); if (refus) return { success: false, error: refus } }
  const { data, error } = await supabase.from('modules').insert(payload).select().single()
  if (error) return { success: false, error: error.message }
  await noterModification(acteur, payload.formation_id, `Module « ${payload.titre} » ajouté`)
  return { success: true, data: data as Module }
}

export async function updateModule(
  moduleId: string,
  payload: Partial<{ titre: string; description: string; ordre: number; duree_minutes: number }>
): Promise<ActionResult<Module>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifié' }
  const acteur = await getCreateurFormations()
  if (!acteur) return { success: false, error: 'Non autorisé : création de formations non permise' }
  { const refus = await refusPourModule(acteur, moduleId); if (refus) return { success: false, error: refus } }
  const { data, error } = await supabase.from('modules').update(payload).eq('id', moduleId).select().single()
  if (error) return { success: false, error: error.message }
  await noterModification(acteur, (data as Module).formation_id, `Module « ${(data as Module).titre} » modifié`, 'module:' + moduleId)
  return { success: true, data: data as Module }
}

export async function deleteModule(moduleId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifié' }
  const acteur = await getCreateurFormations()
  if (!acteur) return { success: false, error: 'Non autorisé : création de formations non permise' }
  { const refus = await refusPourModule(acteur, moduleId); if (refus) return { success: false, error: refus } }
  const f = await formationDuModule(moduleId)
  const { error } = await supabase.from('modules').delete().eq('id', moduleId)
  if (error) return { success: false, error: error.message }
  await noterModification(acteur, f?.formationId, `Module « ${f?.module ?? ''} » supprimé`)
  return { success: true, data: undefined }
}

export async function reorderModules(
  formationId: string,
  ordre: { id: string; ordre: number }[]
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifié' }
  const acteur = await getCreateurFormations()
  if (!acteur) return { success: false, error: 'Non autorisé : création de formations non permise' }
  { const refus = await refusModification(acteur, formationId); if (refus) return { success: false, error: refus } }
  await Promise.all(ordre.map(({ id, ordre: o }) =>
    supabase.from('modules').update({ ordre: o }).eq('id', id).eq('formation_id', formationId)
  ))
  await noterModification(acteur, formationId, 'Ordre des modules modifié', 'ordre-modules')
  return { success: true, data: undefined }
}

const LIBELLE_REGLAGE: Record<string, string> = {
  titre: 'titre', description: 'description', categorie: 'catégorie', niveau: 'niveau', duree_estimee_minutes: 'durée',
  publiee: 'publication', clinique: 'clinique', validite_mois: 'validité du certificat', prerequis_ids: 'prérequis',
  image_couverture: 'image de couverture', sondage_actif: 'sondage', obligatoire: 'obligatoire (LSST)',
  delivre_certificat: 'certificat', responsable_formation: 'responsable de la formation',
  credits_admissible: 'formation continue', credits_heures: 'heures créditables', credits_organisme: 'ordre professionnel', credits_numero: 'n° d’accréditation',
}

/** Note dans l'historique les réglages modifiés depuis la page « Modifier ». */
export async function noterReglages(formationId: string, champs: string[]): Promise<ActionResult> {
  const acteur = await getCreateurFormations()
  if (!acteur) return { success: false, error: 'Non autorisé' }
  const liste = champs.filter(c => c in LIBELLE_REGLAGE).map(c => LIBELLE_REGLAGE[c])
  if (liste.length) await noterModification(acteur, formationId, `Réglages modifiés : ${liste.join(', ')}`)
  return { success: true, data: undefined }
}
