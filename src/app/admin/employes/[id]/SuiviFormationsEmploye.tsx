import type { SupabaseClient } from '@supabase/supabase-js'
import { chargerSuiviFormations, suiviDe } from '@/lib/suivi-formations'
import { chargerEtatQuestionnaire, EtatQuestionnaire } from '@/lib/questionnaire-serveur'
import { getActeur, peutGererEmploye } from '@/lib/permissions'
import ReinitialiserTentatives from './ReinitialiserTentatives'

const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short' }) : null

/** Dossier employé : formations assignées, leçons terminées, vidéos obligatoires, attestations signées. */
export default async function SuiviFormationsEmploye({ sb, employeId }: { sb: SupabaseClient; employeId: string }) {
  const { data: assignations } = await sb.from('assignations').select('formation_id, date_echeance').eq('employe_id', employeId)
  const formationIds = Array.from(new Set((assignations ?? []).map(a => a.formation_id as string)))
  const { data: formations } = formationIds.length
    ? await sb.from('formations').select('id, titre').in('id', formationIds)
    : { data: [] as { id: string; titre: string }[] }
  const suivi = await chargerSuiviFormations(sb, [employeId], formationIds)
  const etatsQ: Record<string, EtatQuestionnaire> = Object.fromEntries(await Promise.all(
    formationIds.map(async fid => [fid, await chargerEtatQuestionnaire(sb, employeId, fid)] as const)))
  const [acteur, { data: cible }] = await Promise.all([
    getActeur(),
    sb.from('employes').select('id, role, clinique, departement_id').eq('id', employeId).single(),
  ])
  const peutGerer = !!acteur && !!cible && peutGererEmploye(acteur, cible)

  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-gray-900 mb-1">Suivi des formations</h2>
      <p className="text-sm text-gray-500 mb-4">Leçons terminées, vidéos obligatoires et attestations « J’ai lu et compris » (preuves horodatées).</p>

      {(formations ?? []).length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-sm text-gray-400">Aucune formation assignée.</div>
      ) : (
        <div className="space-y-3">
          {(formations ?? []).map(f => {
            const s = suiviDe(suivi, employeId, f.id)
            const complet = s && s.lecons_total > 0 && s.lecons_terminees === s.lecons_total
            return (
              <details key={f.id} className="bg-white border border-gray-200 rounded-xl overflow-x-auto" open={(formations ?? []).length === 1}>
                <summary className="px-5 py-4 cursor-pointer flex flex-wrap items-center gap-3 list-none">
                  <span className="font-semibold text-gray-900 flex-1 min-w-[180px]">{f.titre}</span>
                  {s ? (
                    <>
                      <span className={'text-xs font-semibold px-2.5 py-1 rounded-full ' + (complet ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700')}>
                        📘 {s.lecons_terminees}/{s.lecons_total} leçons
                      </span>
                      {s.videos_obligatoires > 0 && (
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">🎬 {s.videos_vues}/{s.videos_obligatoires} vidéos</span>
                      )}
                      {s.attestations_requises > 0 && (
                        <span className={'text-xs font-semibold px-2.5 py-1 rounded-full ' + (s.attestations_signees === s.attestations_requises ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800')}>
                          ✍️ {s.attestations_signees}/{s.attestations_requises} attestations
                        </span>
                      )}
                    </>
                  ) : <span className="text-xs text-gray-400">Aucune leçon</span>}
                  {(() => {
                    const e = etatsQ[f.id]
                    if (!e?.questionnaire) return null
                    if (e.certificatValide) return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">🏆 Certifié ({e.certificat?.note_finale != null ? Math.round(Number(e.certificat.note_finale)) + ' %' : ''})</span>
                    if (e.tentatives.length === 0) return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">📝 Questionnaire non passé</span>
                    const bloque = e.tentativesRestantes === 0 && !e.reussi
                    return (
                      <>
                        <span className={'text-xs font-semibold px-2.5 py-1 rounded-full ' + (bloque ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800')}>
                          📝 {e.tentatives.length} tentative(s){e.questionnaire.nb_tentatives_max ? ` / ${e.questionnaire.nb_tentatives_max}` : ''} · meilleur {e.meilleure ?? 0} % (seuil {e.questionnaire.note_passage} %)
                        </span>
                        {bloque && peutGerer && <ReinitialiserTentatives employeId={employeId} formationId={f.id} />}
                      </>
                    )
                  })()}
                </summary>
                {s && (
                  <table className="w-full text-sm border-t border-gray-100">
                    <thead>
                      <tr className="bg-gray-50 text-xs uppercase text-gray-500">
                        <th className="text-left px-5 py-2 font-semibold">Leçon</th>
                        <th className="text-left px-3 py-2 font-semibold">Terminée</th>
                        <th className="text-center px-3 py-2 font-semibold">Vidéos</th>
                        <th className="text-left px-3 py-2 font-semibold">Lu et compris</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.lecons.map(l => (
                        <tr key={l.lesson_id} className="border-t border-gray-100 align-top">
                          <td className="px-5 py-2.5">
                            <div className="text-gray-900">{l.titre}</div>
                            <div className="text-xs text-gray-400">{l.module_titre}</div>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {l.terminee_le !== null
                              ? <span className="text-green-700">✅ {date(l.terminee_le) ?? ''}</span>
                              : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-center whitespace-nowrap">
                            {l.videos_obligatoires > 0 ? `${l.videos_vues}/${l.videos_obligatoires}` : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-2.5">
                            {!l.attestation_requise ? <span className="text-gray-300">Non requise</span>
                              : l.attestation_le ? (
                                <span title={l.attestation_texte ?? ''} className="text-green-700">✍️ Signée le {date(l.attestation_le)}</span>
                              ) : <span className="text-amber-700">En attente</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </details>
            )
          })}
        </div>
      )}
    </section>
  )
}
