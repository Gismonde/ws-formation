import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getActeur, serviceClient, peutVoirContenu } from '@/lib/permissions'
import { aAccesAdmin } from '@/lib/cliniques'
import { statistiquesFormation } from '@/lib/statistiques-formation'
import { LIBELLE_STATUT } from '@/lib/etat-formations'
import { QUESTIONS_SONDAGE } from '@/lib/sondages'
import { i18n } from '@/lib/i18n/serveur'

// Statistiques d'une formation : avancement, entonnoir des leçons, questionnaire (questions difficiles), départements, satisfaction.
export default async function StatistiquesFormationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!aAccesAdmin(acteur)) redirect('/dashboard/accueil')
  const { t, loc } = await i18n()
  const sb = serviceClient()
  const { data: f } = await sb.from('formations').select('id, titre, clinique').eq('id', id).maybeSingle()
  if (!f || !peutVoirContenu(acteur, f.clinique)) notFound()
  const s = await statistiquesFormation(sb, acteur, id)
  const jour = (d: string | null) => (d ? new Date(d.length === 10 ? d + 'T12:00:00' : d).toLocaleDateString(loc, { dateStyle: 'medium' }) : '—')

  const Tuile = ({ v, l, c = 'text-gray-900', sous }: { v: string | number; l: string; c?: string; sous?: string }) => (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className={'text-2xl font-bold ' + c}>{v}</p>
      <p className="text-xs text-gray-500 mt-0.5">{l}</p>
      {sous && <p className="text-[11px] text-gray-400 mt-0.5">{sous}</p>}
    </div>
  )
  const Barre = ({ v, max, couleur = 'bg-indigo-500' }: { v: number; max: number; couleur?: string }) => (
    <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden"><div className={'h-full ' + couleur} style={{ width: `${max > 0 ? Math.round((v / max) * 100) : 0}%` }} /></div>
  )
  const Section = ({ titre, children, aide }: { titre: string; children: React.ReactNode; aide?: string }) => (
    <section className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
      <h2 className="text-base font-semibold text-gray-900">{titre}</h2>
      {aide && <p className="text-xs text-gray-500 mb-3">{aide}</p>}
      <div className={aide ? '' : 'mt-3'}>{children}</div>
    </section>
  )
  const couleurTaux = (x: number) => (x >= 80 ? 'bg-green-500' : x >= 50 ? 'bg-amber-500' : 'bg-red-500')
  const COULEUR_STATUT: Record<string, string> = { non_commence: 'bg-gray-100 text-gray-600', en_cours: 'bg-amber-50 text-amber-700', termine: 'bg-indigo-50 text-indigo-700', certifie: 'bg-green-50 text-green-700' }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <nav className="text-sm text-gray-500 mb-4 flex gap-2 flex-wrap">
          <Link href="/admin/formations" className="hover:text-gray-700">{t('Formations')}</Link><span>›</span>
          <Link href={`/admin/formations/${id}`} className="hover:text-gray-700 truncate max-w-xs">{f.titre}</Link><span>›</span>
          <span className="text-gray-800 font-medium">{t('Statistiques')}</span>
        </nav>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">📊 {t('Statistiques')} — {f.titre}</h1>
        <p className="text-sm text-gray-500 mb-6">{t('Employés de votre périmètre seulement. Les chiffres sont calculés en direct.')}</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <Tuile v={s.totaux.assignes} l={t('Assignés')} />
          <Tuile v={s.totaux.commences} l={t('Ont commencé')} />
          <Tuile v={s.totaux.termines} l={t('Terminé')} c="text-indigo-700" />
          <Tuile v={s.totaux.certifies} l={t('Certifiés')} c="text-green-700" />
          <Tuile v={s.totaux.en_retard} l={t('En retard')} c={s.totaux.en_retard ? 'text-red-600' : 'text-gray-900'} />
          <Tuile v={s.totaux.taux + ' %'} l={t('Taux de complétion')} sous={s.delaiMoyenJours !== null ? t('{n} j en moyenne pour terminer', { n: s.delaiMoyenJours }) : undefined} />
        </div>

        {s.totaux.assignes === 0 && <p className="bg-white rounded-2xl border border-gray-200 p-6 text-sm text-gray-500 mb-6">{t('Aucun employé de votre périmètre n’a encore cette formation assignée.')}</p>}

        {s.lecons.length > 0 && s.totaux.assignes > 0 && (
          <Section titre={t('Parcours dans les leçons')} aide={t('Combien d’employés ont commencé et terminé chaque leçon : une forte baisse signale une leçon où l’on décroche.')}>
            <ul className="space-y-3">
              {s.lecons.map((l, i) => (
                <li key={l.id}>
                  <div className="flex justify-between gap-3 text-sm mb-1">
                    <span className="text-gray-800 truncate"><span className="text-gray-400 mr-1">{i + 1}.</span>{l.titre} <span className="text-xs text-gray-400">· {l.module}</span></span>
                    <span className="text-gray-600 whitespace-nowrap">{t('{a} terminée(s) · {b} commencée(s)', { a: l.terminees, b: l.commencees })}</span>
                  </div>
                  <Barre v={l.terminees} max={s.totaux.assignes} />
                </li>
              ))}
            </ul>
          </Section>
        )}

        {s.questionnaire && (
          <Section titre={t('Questionnaire')}>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
              <Tuile v={s.questionnaire.tentatives} l={t('Tentatives')} />
              <Tuile v={`${s.questionnaire.reussis}/${s.questionnaire.employes}`} l={t('Employés ayant réussi')} />
              <Tuile v={s.questionnaire.premierEssai + ' %'} l={t('Réussite au 1er essai')} />
              <Tuile v={s.questionnaire.scoreMoyen !== null ? s.questionnaire.scoreMoyen + ' %' : '—'} l={t('Score moyen')} />
              <Tuile v={s.questionnaire.dureeMoyenneMin !== null ? s.questionnaire.dureeMoyenneMin + ' min' : '—'} l={t('Durée moyenne')} />
            </div>
            {s.questionnaire.tentatives > 0 && (
              <>
                <p className="text-sm font-semibold text-gray-800 mb-1">{t('Réussite par question')}</p>
                <p className="text-xs text-gray-500 mb-3">{t('Les questions les moins réussies en premier : à clarifier dans le contenu ou à reformuler.')}</p>
                <ul className="space-y-2.5">
                  {s.questionnaire.questions.map(q => (
                    <li key={q.id}>
                      <div className="flex justify-between gap-3 text-sm mb-1">
                        <span className="text-gray-800">{q.texte}</span>
                        <span className="font-semibold whitespace-nowrap">{q.taux} % <span className="text-xs font-normal text-gray-400">({q.repondues})</span></span>
                      </div>
                      <Barre v={q.taux} max={100} couleur={couleurTaux(q.taux)} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Section>
        )}

        {s.departements.length > 1 && (
          <Section titre={t('Par département')}>
            <ul className="space-y-2.5">
              {s.departements.map(d => (
                <li key={d.nom}>
                  <div className="flex justify-between text-sm mb-1"><span className="text-gray-800">{d.nom}</span><span className="text-gray-600">{d.termines}/{d.assignes} · <strong>{d.taux} %</strong></span></div>
                  <Barre v={d.taux} max={100} couleur={couleurTaux(d.taux)} />
                </li>
              ))}
            </ul>
          </Section>
        )}

        {s.sondage && (
          <Section titre={t('Satisfaction')} aide={t('{n} réponse(s) au sondage · {p} % satisfaits', { n: s.sondage.reponses, p: s.sondage.satisfaits ?? 0 })}>
            <ul className="space-y-2.5">
              {QUESTIONS_SONDAGE.map(qs => {
                const m = s.sondage!.moyennes[qs.cle]
                return (
                  <li key={qs.cle}>
                    <div className="flex justify-between gap-3 text-sm mb-1"><span className="text-gray-800">{t(qs.texte)}</span><span className="font-semibold">{m !== null ? m.toFixed(1) : '—'} / 5</span></div>
                    <Barre v={m ?? 0} max={5} couleur={couleurTaux(((m ?? 0) / 5) * 100)} />
                  </li>
                )
              })}
            </ul>
            {s.sondage.commentaires.length > 0 && (
              <details className="mt-4">
                <summary className="text-sm font-semibold text-gray-800 cursor-pointer">{t('Commentaires')} ({s.sondage.commentaires.length})</summary>
                <ul className="mt-2 space-y-2">{s.sondage.commentaires.map((c, i) => <li key={i} className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">« {c.texte} » <span className="text-xs text-gray-400">{jour(c.date)}</span></li>)}</ul>
              </details>
            )}
          </Section>
        )}

        {s.employes.length > 0 && (
          <Section titre={t('Employés')}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="py-2 pr-3">{t('Employé')}</th><th className="py-2 pr-3">{t('Département')}</th><th className="py-2 pr-3">{t('Statut')}</th>
                  <th className="py-2 pr-3">{t('Progression')}</th><th className="py-2 pr-3">{t('Assignée le')}</th><th className="py-2">{t('Échéance')}</th>
                </tr></thead>
                <tbody>
                  {s.employes.map(e => (
                    <tr key={e.id} className="border-b border-gray-50">
                      <td className="py-2 pr-3"><Link href={`/admin/employes/${e.id}?onglet=formations`} className="text-gray-900 hover:text-indigo-700 font-medium">{e.nom}</Link></td>
                      <td className="py-2 pr-3 text-gray-600">{e.departement}</td>
                      <td className="py-2 pr-3"><span className={'text-xs font-semibold px-2 py-0.5 rounded-full ' + COULEUR_STATUT[e.statut]}>{t(LIBELLE_STATUT[e.statut])}</span></td>
                      <td className="py-2 pr-3 text-gray-600">{e.progression} %</td>
                      <td className="py-2 pr-3 text-gray-600">{jour(e.date_assignation)}</td>
                      <td className={'py-2 ' + (e.en_retard ? 'text-red-600 font-semibold' : 'text-gray-600')}>{jour(e.date_echeance)}{e.en_retard ? ' · ' + t('en retard') : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}
