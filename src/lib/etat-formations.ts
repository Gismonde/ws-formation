// État réel d'une formation pour un employé (conformité, relances, exports).
// Même définition que l'écran de l'employé : avancement = modules OU leçons terminés (le plus favorable),
// « certifié » = certificat valide et non expiré, « terminé » = tout le contenu fait et aucun questionnaire à réussir.
import type { SupabaseClient } from '@supabase/supabase-js'
import { chargerSuiviFormations, suiviDe, type SuiviFormationEmploye } from '@/lib/suivi-formations'

export type StatutFormation = 'non_commence' | 'en_cours' | 'termine' | 'certifie'

export const LIBELLE_STATUT: Record<StatutFormation, string> = {
  non_commence: 'Non commencé',
  en_cours: 'En cours',
  termine: 'Terminé',
  certifie: 'Certifié',
}

export function estComplete(s: StatutFormation): boolean {
  return s === 'termine' || s === 'certifie'
}

export function statutFormation(p: {
  progressionPct: number
  aQuestionnaire: boolean
  certificatValide: boolean
  commence: boolean
}): StatutFormation {
  if (p.certificatValide) return 'certifie'
  if (p.progressionPct >= 100 && !p.aQuestionnaire) return 'termine'
  if (p.progressionPct > 0 || p.commence) return 'en_cours'
  return 'non_commence'
}

export type CertificatEtat = {
  numero_certificat: string | null
  date_emission: string | null
  date_expiration: string | null
  valide: boolean | null
  note_finale: number | null
}

export type EtatFormation = {
  statut: StatutFormation
  progression: number
  certificat: CertificatEtat | null
  certificat_valide: boolean
  suivi: SuiviFormationEmploye | null
}

export function certificatValide(c: CertificatEtat | null, aujourdhui = new Date()): boolean {
  if (!c || c.valide === false) return false
  if (!c.date_expiration) return true
  return new Date(c.date_expiration.slice(0, 10) + 'T23:59:59') >= aujourdhui
}

const cle = (e: string, f: string) => `${e}:${f}`

/** États pour toutes les paires (employé, formation) demandées, en un minimum de requêtes. */
export async function chargerEtatsFormations(
  sb: SupabaseClient,
  employeIds: string[],
  formationIds: string[],
): Promise<(employeId: string, formationId: string) => EtatFormation> {
  const vide: EtatFormation = { statut: 'non_commence', progression: 0, certificat: null, certificat_valide: false, suivi: null }
  if (employeIds.length === 0 || formationIds.length === 0) return () => vide

  const [suivi, { data: modules }, { data: questionnaires }] = await Promise.all([
    chargerSuiviFormations(sb, employeIds, formationIds),
    sb.from('modules').select('id, formation_id').in('formation_id', formationIds),
    sb.from('questionnaires').select('id, formation_id, actif').in('formation_id', formationIds),
  ])
  const [{ data: certs }, { data: progMods }] = await Promise.all([
    sb.from('certificats').select('employe_id, formation_id, numero_certificat, date_emission, date_expiration, valide, note_finale')
      .in('employe_id', employeIds).in('formation_id', formationIds),
    sb.from('progressions').select('employe_id, formation_id, module_id, statut')
      .in('employe_id', employeIds).in('formation_id', formationIds),
  ])

  const nbModules = new Map<string, number>()
  for (const m of modules ?? []) nbModules.set(m.formation_id, (nbModules.get(m.formation_id) ?? 0) + 1)
  const avecQuestionnaire = new Set((questionnaires ?? []).filter(q => q.actif !== false).map(q => q.formation_id as string))
  const certParCle = new Map<string, CertificatEtat>()
  for (const c of certs ?? []) certParCle.set(cle(c.employe_id, c.formation_id), c as CertificatEtat)
  const modulesFaits = new Map<string, Set<string>>()
  const commences = new Set<string>()
  for (const p of progMods ?? []) {
    const k = cle(p.employe_id, p.formation_id)
    commences.add(k)
    if (p.statut === 'termine' && p.module_id) {
      if (!modulesFaits.has(k)) modulesFaits.set(k, new Set())
      modulesFaits.get(k)!.add(p.module_id)
    }
  }

  return (employeId: string, formationId: string): EtatFormation => {
    const k = cle(employeId, formationId)
    const s = suiviDe(suivi, employeId, formationId)
    const totalMod = nbModules.get(formationId) ?? 0
    const pctModules = totalMod ? Math.round(((modulesFaits.get(k)?.size ?? 0) / totalMod) * 100) : 0
    const pctLecons = s && s.lecons_total ? Math.round((s.lecons_terminees / s.lecons_total) * 100) : 0
    const cert = certParCle.get(k) ?? null
    const valide = certificatValide(cert)
    const progression = valide ? 100 : (totalMod === 0 ? 100 : Math.max(pctModules, pctLecons))
    return {
      statut: statutFormation({
        progressionPct: progression,
        aQuestionnaire: avecQuestionnaire.has(formationId),
        certificatValide: valide,
        commence: commences.has(k) || (s?.lecons_terminees ?? 0) > 0,
      }),
      progression,
      certificat: cert,
      certificat_valide: valide,
      suivi: s,
    }
  }
}
