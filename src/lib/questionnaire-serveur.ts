// Questionnaire d'évaluation et certificats : tout est calculé côté serveur.
// Le navigateur ne reçoit jamais les bonnes réponses avant d'avoir réussi, et ne peut ni fixer sa note
// ni créer lui-même un certificat.
import type { SupabaseClient } from '@supabase/supabase-js'

export const SEUIL_PAR_DEFAUT = 70

export type Tentative = {
  id: string
  numero: number
  pourcentage: number
  reussi: boolean
  date: string | null
}

export type Certificat = {
  id: string
  numero_certificat: string | null
  date_emission: string | null
  date_expiration: string | null
  note_finale: number | null
  valide: boolean | null
}

export type EtatQuestionnaire = {
  questionnaire: {
    id: string
    titre: string
    description: string | null
    note_passage: number
    nb_tentatives_max: number | null
    duree_minutes: number | null
  } | null
  /** Pourcentage d'avancement de la formation (modules ou leçons terminés) */
  progressionPct: number
  formationTerminee: boolean
  tentatives: Tentative[]
  meilleure: number | null
  reussi: boolean
  /** null = illimité */
  tentativesRestantes: number | null
  certificat: Certificat | null
  certificatValide: boolean
}

export const pourcentage = (t: { note_obtenue: number | null; note_maximale: number | null }) =>
  t.note_maximale && t.note_maximale > 0 ? Math.round(((t.note_obtenue ?? 0) / t.note_maximale) * 100) : 0

/** Avancement d'un employé dans une formation (modules terminés OU leçons terminées, le plus favorable). */
export async function progressionFormation(sb: SupabaseClient, employeId: string, formationId: string): Promise<number> {
  const { data: modules } = await sb.from('modules').select('id').eq('formation_id', formationId)
  const moduleIds = (modules ?? []).map(m => m.id as string)
  if (moduleIds.length === 0) return 100

  const [{ data: progMod }, { data: lecons }] = await Promise.all([
    sb.from('progressions').select('module_id, statut').eq('employe_id', employeId).eq('formation_id', formationId),
    sb.from('lessons').select('id').in('module_id', moduleIds),
  ])
  const modulesFaits = new Set((progMod ?? []).filter(p => p.statut === 'termine').map(p => p.module_id)).size
  const pctModules = Math.round((modulesFaits / moduleIds.length) * 100)

  let pctLecons = 0
  const leconIds = (lecons ?? []).map(l => l.id as string)
  if (leconIds.length > 0) {
    const { data: progLec } = await sb.from('lesson_progressions').select('lesson_id, statut')
      .eq('employe_id', employeId).in('lesson_id', leconIds).eq('statut', 'termine')
    pctLecons = Math.round((new Set((progLec ?? []).map(p => p.lesson_id)).size / leconIds.length) * 100)
  }
  return Math.max(pctModules, pctLecons)
}

export function certificatEstValide(c: Certificat | null): boolean {
  if (!c || c.valide === false) return false
  if (!c.date_expiration) return true
  return new Date(c.date_expiration + 'T23:59:59') >= new Date()
}

export async function chargerEtatQuestionnaire(sb: SupabaseClient, employeId: string, formationId: string): Promise<EtatQuestionnaire> {
  const [{ data: q }, { data: cert }, progressionPct] = await Promise.all([
    sb.from('questionnaires').select('id, titre, description, note_passage, nb_tentatives_max, duree_minutes')
      .eq('formation_id', formationId).eq('actif', true).order('created_at').limit(1).maybeSingle(),
    sb.from('certificats').select('id, numero_certificat, date_emission, date_expiration, note_finale, valide')
      .eq('employe_id', employeId).eq('formation_id', formationId).maybeSingle(),
    progressionFormation(sb, employeId, formationId),
  ])

  let tentatives: Tentative[] = []
  if (q) {
    const { data: ts } = await sb.from('tentatives_questionnaire').select('*')
      .eq('employe_id', employeId).eq('questionnaire_id', q.id).order('date_fin', { ascending: false })
    tentatives = (ts ?? [])
      .filter(t => t.annulee !== true) // tentatives remises à zéro par un gestionnaire
      .map(t => ({ id: t.id, numero: t.numero_tentative ?? 0, pourcentage: pourcentage(t), reussi: t.reussi === true, date: t.date_fin ?? t.date_debut ?? null }))
  }

  const reussi = tentatives.some(t => t.reussi)
  const max = q?.nb_tentatives_max && q.nb_tentatives_max > 0 ? q.nb_tentatives_max : null
  const certificat = (cert as Certificat | null) ?? null

  return {
    questionnaire: q ? { ...q, note_passage: q.note_passage ?? SEUIL_PAR_DEFAUT } : null,
    progressionPct,
    formationTerminee: progressionPct >= 100,
    tentatives,
    meilleure: tentatives.length ? Math.max(...tentatives.map(t => t.pourcentage)) : null,
    reussi,
    tentativesRestantes: max === null ? null : Math.max(0, max - tentatives.length),
    certificat,
    certificatValide: certificatEstValide(certificat),
  }
}

/** Émet (ou renouvelle) le certificat de l'employé pour cette formation. */
export async function emettreCertificat(sb: SupabaseClient, employeId: string, formationId: string, note: number): Promise<Certificat | null> {
  const { data: formation } = await sb.from('formations').select('validite_mois').eq('id', formationId).single()
  const maintenant = new Date()
  let expiration: string | null = null
  if (formation?.validite_mois && formation.validite_mois > 0) {
    const d = new Date(maintenant)
    d.setMonth(d.getMonth() + formation.validite_mois)
    expiration = d.toISOString().slice(0, 10)
  }
  const valeurs = {
    numero_certificat: 'CERT-' + crypto.randomUUID().slice(0, 8).toUpperCase(),
    date_emission: maintenant.toISOString(),
    date_expiration: expiration,
    note_finale: note,
    valide: true,
  }
  const champs = 'id, numero_certificat, date_emission, date_expiration, note_finale, valide'
  const { data: existant } = await sb.from('certificats').select('id').eq('employe_id', employeId).eq('formation_id', formationId).maybeSingle()
  const { data, error } = existant
    ? await sb.from('certificats').update(valeurs).eq('id', existant.id).select(champs).single()
    : await sb.from('certificats').insert({ employe_id: employeId, formation_id: formationId, ...valeurs }).select(champs).single()
  if (error) {
    console.error('[Certificat] Émission impossible', error)
    return null
  }
  return data as Certificat
}
