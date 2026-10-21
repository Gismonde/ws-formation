import { i18n } from '@/lib/i18n/serveur'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActeur, serviceClient } from '@/lib/permissions'
import { aAccesAdmin } from '@/lib/cliniques'
import { QUESTIONS_SONDAGE, ECHELLE } from '@/lib/sondages'
import { chargerResultatsSondages } from '@/lib/sondages-admin'

const couleur = (m: number | null) => (m === null ? '#9ca3af' : m >= 4 ? '#047857' : m >= 3 ? '#b45309' : '#b91c1c')

export default async function SondagesPage({ searchParams }: { searchParams: Promise<{ formation?: string }> }) {
  const { t, loc } = await i18n()
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!aAccesAdmin(acteur.role)) redirect('/dashboard/accueil')
  const { formation } = await searchParams
  const { actif, lignes } = await chargerResultatsSondages(serviceClient(), acteur)
  const choisie = lignes.find(l => l.formation_id === formation) ?? null
  const total = lignes.reduce((s, l) => s + l.reponses, 0)

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Sondages de satisfaction')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Proposés à l&apos;employé à la fin de chaque formation, séparément de l&apos;examen. Résultats présentés sans nom.
          </p>
        </div>
        {actif && total > 0 && (
          <a href="/api/admin/sondages/export" className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">{t('⬇ Excel')}</a>
        )}
      </div>

      {!actif ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-5 text-sm">
          {t('Les sondages seront actifs une fois le script')} <code>{t('supabase/migrations/conformite_suivi.sql')}</code> {t('exécuté dans Supabase.')}
        </div>
      ) : lignes.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400">{t('Aucune réponse pour le moment.')}</div>
      ) : (
        <>
          <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto mb-6">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="bg-gray-50 text-xs uppercase text-gray-500">
                  <th className="text-left px-4 py-3 font-semibold">{t('Formation')}</th>
                  <th className="text-center px-3 py-3 font-semibold">{t('Réponses')}</th>
                  <th className="text-center px-3 py-3 font-semibold">{t('Satisfaits')}</th>
                  {QUESTIONS_SONDAGE.map(q => <th key={q.cle} className="text-center px-2 py-3 font-semibold" title={q.texte}>{({ note_globale: 'Globale', clarte: 'Clarté', utilite: 'Utilité', duree: 'Durée', recommandation: 'Recomm.' })[q.cle]}</th>)}
                  <th />
                </tr>
              </thead>
              <tbody>
                {lignes.map(l => (
                  <tr key={l.formation_id} className={'border-t border-gray-100 ' + (choisie?.formation_id === l.formation_id ? 'bg-indigo-50/40' : '')}>
                    <td className="px-4 py-3 font-medium text-gray-900">{l.titre}</td>
                    <td className="text-center px-3 py-3">{l.reponses}</td>
                    <td className="text-center px-3 py-3 font-semibold" style={{ color: (l.satisfaits ?? 0) >= 80 ? '#047857' : (l.satisfaits ?? 0) >= 60 ? '#b45309' : '#b91c1c' }}>{l.satisfaits} %</td>
                    {QUESTIONS_SONDAGE.map(q => <td key={q.cle} className="text-center px-2 py-3 font-semibold" style={{ color: couleur(l.moyennes[q.cle]) }}>{l.moyennes[q.cle]?.toFixed(1) ?? '—'}</td>)}
                    <td className="px-3 py-3 text-right"><Link href={`/admin/sondages?formation=${l.formation_id}`} className="text-indigo-600 hover:underline text-xs font-semibold">{t('Détail')}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-gray-400 px-4 py-2 border-t border-gray-100">Moyennes sur 5. « Satisfaits » = réponses 4 ou 5 à la satisfaction globale.</p>
          </div>

          {choisie && (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">{choisie.titre} — {choisie.reponses} réponse{choisie.reponses > 1 ? 's' : ''}</h2>
              <div className="space-y-4 mb-6">
                {QUESTIONS_SONDAGE.map(q => (
                  <div key={q.cle}>
                    <div className="flex justify-between text-sm mb-1"><span className="text-gray-700">{q.texte}</span><span className="font-semibold" style={{ color: couleur(choisie.moyennes[q.cle]) }}>{choisie.moyennes[q.cle]?.toFixed(1)} / 5</span></div>
                    <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
                      {choisie.repartition[q.cle].map((n, i) => n > 0 && (
                        <div key={i} title={`${ECHELLE[i]} : ${n}`} style={{ width: `${(n / choisie.reponses) * 100}%`, background: ['#dc2626', '#f97316', '#d1d5db', '#34d399', '#059669'][i] }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Commentaires ({choisie.commentaires.length})</h3>
              {choisie.commentaires.length === 0 ? <p className="text-sm text-gray-400">{t('Aucun commentaire.')}</p> : (
                <ul className="space-y-2">
                  {choisie.commentaires.map((c, i) => (
                    <li key={i} className="text-sm text-gray-700 bg-gray-50 rounded-lg px-4 py-3">
                      « {c.texte} »
                      <span className="block text-xs text-gray-400 mt-1">{new Date(c.date).toLocaleDateString(loc, { dateStyle: 'medium' })}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
