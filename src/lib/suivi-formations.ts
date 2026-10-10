// Suivi détaillé des formations (côté administration) :
// leçons terminées, vidéos obligatoires vues, attestations « J'ai lu et compris ».
import type { SupabaseClient } from '@supabase/supabase-js'

export type SuiviLeconEmploye = {
  lesson_id: string
  titre: string
  module_titre: string
  terminee_le: string | null
  attestation_requise: boolean
  attestation_le: string | null
  attestation_texte: string | null
  videos_obligatoires: number
  videos_vues: number
}

export type SuiviFormationEmploye = {
  lecons_total: number
  lecons_terminees: number
  attestations_requises: number
  attestations_signees: number
  videos_obligatoires: number
  videos_vues: number
  lecons: SuiviLeconEmploye[]
}

const cle = (employeId: string, formationId: string) => `${employeId}:${formationId}`

/** Renvoie le suivi par « employeId:formationId ». */
export async function chargerSuiviFormations(
  sb: SupabaseClient,
  employeIds: string[],
  formationIds: string[],
): Promise<Record<string, SuiviFormationEmploye>> {
  const resultat: Record<string, SuiviFormationEmploye> = {}
  if (employeIds.length === 0 || formationIds.length === 0) return resultat

  const { data: modules } = await sb.from('modules').select('id, titre, formation_id, ordre').in('formation_id', formationIds)
  const moduleIds = (modules ?? []).map(m => m.id)
  if (moduleIds.length === 0) return resultat

  const { data: lecons } = await sb.from('lessons').select('id, titre, module_id, ordre, attestation_requise').in('module_id', moduleIds)
  const leconIds = (lecons ?? []).map(l => l.id)
  if (leconIds.length === 0) return resultat

  const [{ data: videos }, { data: progressions }, { data: preuves }] = await Promise.all([
    sb.from('content_blocks').select('id, lesson_id, metadata').eq('type', 'video').in('lesson_id', leconIds),
    sb.from('lesson_progressions').select('employe_id, lesson_id, statut, date_fin')
      .in('employe_id', employeIds).in('lesson_id', leconIds).eq('statut', 'termine'),
    sb.from('preuves_lecture').select('employe_id, lesson_id, bloc_id, type, texte, created_at')
      .in('employe_id', employeIds).in('lesson_id', leconIds),
  ])

  const moduleParId = new Map((modules ?? []).map(m => [m.id, m]))
  const videosOblig = (videos ?? []).filter(v => (v.metadata as Record<string, unknown> | null)?.obligatoire === true)

  const leconsTriees = [...(lecons ?? [])].sort((a, b) => {
    const ma = moduleParId.get(a.module_id), mb = moduleParId.get(b.module_id)
    return (ma?.ordre ?? 0) - (mb?.ordre ?? 0) || (a.ordre ?? 0) - (b.ordre ?? 0)
  })

  for (const employeId of employeIds) {
    for (const formationId of formationIds) {
      const leconsFormation = leconsTriees.filter(l => moduleParId.get(l.module_id)?.formation_id === formationId)
      if (leconsFormation.length === 0) continue
      const detail: SuiviLeconEmploye[] = leconsFormation.map(l => {
        const prog = (progressions ?? []).find(p => p.employe_id === employeId && p.lesson_id === l.id)
        const att = (preuves ?? []).find(p => p.employe_id === employeId && p.lesson_id === l.id && p.type === 'attestation')
        const vids = videosOblig.filter(v => v.lesson_id === l.id)
        const vues = vids.filter(v => (preuves ?? []).some(p => p.employe_id === employeId && p.type === 'video_complete' && p.bloc_id === v.id))
        return {
          lesson_id: l.id,
          titre: l.titre,
          module_titre: moduleParId.get(l.module_id)?.titre ?? '',
          terminee_le: prog ? (prog.date_fin ?? '') : null,
          attestation_requise: l.attestation_requise === true,
          attestation_le: att?.created_at ?? null,
          attestation_texte: att?.texte ?? null,
          videos_obligatoires: vids.length,
          videos_vues: vues.length,
        }
      })
      resultat[cle(employeId, formationId)] = {
        lecons_total: detail.length,
        lecons_terminees: detail.filter(d => d.terminee_le !== null).length,
        attestations_requises: detail.filter(d => d.attestation_requise).length,
        attestations_signees: detail.filter(d => d.attestation_requise && d.attestation_le).length,
        videos_obligatoires: detail.reduce((s, d) => s + d.videos_obligatoires, 0),
        videos_vues: detail.reduce((s, d) => s + d.videos_vues, 0),
        lecons: detail,
      }
    }
  }
  return resultat
}

export function suiviDe(suivi: Record<string, SuiviFormationEmploye>, employeId: string, formationId: string) {
  return suivi[cle(employeId, formationId)] ?? null
}
