// Formation sans questionnaire : le certificat est délivré dès que toutes les leçons sont terminées.
import type { SupabaseClient } from '@supabase/supabase-js'
import { emettreCertificat } from '@/lib/questionnaire-serveur'
import { certificatValide, type CertificatEtat } from '@/lib/etat-formations'
import { logAudit } from '@/lib/audit'

/** Toutes les leçons sont-elles terminées ? (fonction pure, testée) */
export function toutesTerminees(lecons: string[], terminees: string[]): boolean {
  return lecons.length > 0 && lecons.every(l => terminees.includes(l))
}

export async function certifierSiSansQuestionnaire(sb: SupabaseClient, employeId: string, lessonId: string, reseau: { ip_address?: string | null; user_agent?: string | null } = {}) {
  const { data: l } = await sb.from('lessons').select('modules(formation_id)').eq('id', lessonId).maybeSingle()
  const m = l?.modules as { formation_id?: string } | { formation_id?: string }[] | null | undefined
  const formationId = (Array.isArray(m) ? m[0] : m)?.formation_id
  if (!formationId) return null
  const [{ data: f }, { data: q }, { data: cert }] = await Promise.all([
    sb.from('formations').select('titre, publiee, delivre_certificat').eq('id', formationId).maybeSingle(),
    sb.from('questionnaires').select('id').eq('formation_id', formationId).eq('actif', true).limit(1),
    sb.from('certificats').select('numero_certificat, date_emission, date_expiration, valide, note_finale').eq('employe_id', employeId).eq('formation_id', formationId).maybeSingle(),
  ])
  if (!f?.publiee || f.delivre_certificat === false || (q ?? []).length > 0) return null
  if (certificatValide(cert as CertificatEtat | null)) return null
  const { data: mods } = await sb.from('modules').select('id').eq('formation_id', formationId)
  const { data: lecons } = (mods ?? []).length ? await sb.from('lessons').select('id').in('module_id', (mods ?? []).map(x => x.id)) : { data: [] }
  const ids = (lecons ?? []).map(x => x.id as string)
  const { data: faites } = ids.length ? await sb.from('lesson_progressions').select('lesson_id').eq('employe_id', employeId).eq('statut', 'termine').in('lesson_id', ids) : { data: [] }
  if (!toutesTerminees(ids, (faites ?? []).map(x => x.lesson_id as string))) return null
  const nouveau = await emettreCertificat(sb, employeId, formationId, 100)
  await logAudit({
    acteur_id: employeId, cible_employe_id: employeId, formation_id: formationId,
    type_action: nouveau ? 'CERTIFICAT_OBTENU' : 'CERTIFICAT_ECHOUE',
    description: nouveau ? `Certificat ${nouveau.numero_certificat} émis pour « ${f.titre} » (formation sans questionnaire, toutes les leçons terminées)` : `Échec de l’émission du certificat pour « ${f.titre} »`,
    metadata: { certificat_id: nouveau?.id ?? null, sans_questionnaire: true }, ...reseau,
  })
  return nouveau
}
