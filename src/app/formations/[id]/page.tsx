import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/permissions'
import { chargerEtatQuestionnaire } from '@/lib/questionnaire-serveur'
import { etatSondage } from '@/lib/sondages'
import { i18n } from '@/lib/i18n/serveur'

export default async function FormationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { t, loc } = await i18n()

  const { data: employe } = await supabase
    .from('employes')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single()

  if (!employe) redirect('/login')

  // Admins/gestionnaires peuvent accéder sans assignation
  const isAdmin = ['super_admin', 'admin', 'gestionnaire'].includes(employe.role)

  if (!isAdmin) {
    const { data: assignation } = await supabase
      .from('assignations')
      .select('formation_id')
      .eq('employe_id', employe.id)
      .eq('formation_id', id)
      .maybeSingle()
    if (!assignation) notFound()
  }

  const { data: formation } = await supabase
    .from('formations')
    .select('*')
    .eq('id', id)
    .eq('publiee', true)
    .single()

  if (!formation) notFound()

  const { data: modules } = await supabase
    .from('modules')
    .select('id, titre, duree_minutes, ordre')
    .eq('formation_id', id)
    .order('ordre')

  const { data: progressions } = await supabase
    .from('progressions')
    .select('module_id, statut')
    .eq('employe_id', employe.id)
    .eq('formation_id', id)

  // Questionnaire, tentatives et certificat : calculés côté serveur
  const etatQ = await chargerEtatQuestionnaire(serviceClient(), employe.id, id)
  const questionnaire = etatQ.questionnaire
  const certificat = etatQ.certificat
  const derniere = etatQ.tentatives[0] ?? null
  const resultatQ = derniere ? { score: etatQ.reussi ? (etatQ.meilleure ?? derniere.pourcentage) : derniere.pourcentage, reussi: etatQ.reussi, created_at: derniere.date } : null

  const modulesTermines = new Set(progressions?.filter((p: any) => p.statut === 'termine').map((p: any) => p.module_id) ?? [])
  const progressionPct = Math.max(etatQ.progressionPct, modules?.length ? Math.round((modulesTermines.size / modules.length) * 100) : 0)
  const estTerminee = progressionPct === 100
  const sondage = isAdmin ? 'inactif' : await etatSondage(serviceClient(), employe.id, id)

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/dashboard" className="text-gray-500 hover:text-gray-900 text-sm">{t('← Tableau de bord')}</Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

        {/* Bandeau de complétion */}
        {estTerminee && (
          <div style={{ background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)', border: '1px solid #6ee7b7', borderRadius: '12px', padding: '20px 24px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '32px' }}>✅</span>
              <div>
                <p style={{ fontWeight: '700', color: '#065f46', fontSize: '16px', margin: 0 }}>{t('Formation complétée !')}</p>
                {certificat && (
                  <p style={{ color: '#047857', fontSize: '13px', margin: '2px 0 0' }}>
                    {t('Certifié le {date} — N° {numero}', { date: certificat.date_emission ? formatDate(certificat.date_emission) : '—', numero: certificat.numero_certificat ?? '' })}
                  </p>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              {resultatQ && (
                <div style={{ background: resultatQ.reussi ? '#059669' : '#dc2626', color: '#fff', borderRadius: '8px', padding: '8px 16px', textAlign: 'center' }}>
                  <p style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>{resultatQ.score}%</p>
                  <p style={{ fontSize: '11px', margin: 0 }}>{resultatQ.reussi ? `✓ ${t('Réussi')}` : `✗ ${t('Échoué')}`}</p>
                </div>
              )}
              {certificat && (
                <Link href={'/certificat/' + certificat.id} style={{ background: '#fbbf24', color: '#78350f', fontWeight: '700', fontSize: '13px', padding: '8px 16px', borderRadius: '8px', textDecoration: 'none' }}>
                  🏆 {t('Voir le certificat')}
                </Link>
              )}
            </div>
          </div>
        )}

        {sondage === 'a_repondre' && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-gray-900">💬 {t('Votre avis compte')}</p>
              <p className="text-sm text-gray-500">{t('Aidez-nous à améliorer cette formation : 5 questions, 1 minute.')}</p>
            </div>
            <Link href={`/formations/${id}/sondage`} className="px-4 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: 'var(--accent-clinique, #4f46e5)' }}>{t('Donner mon avis')}</Link>
          </div>
        )}

        {/* Info formation */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded mb-2 inline-block">{formation.categorie}</span>
          <h1 className="text-2xl font-bold text-gray-900">{formation.titre}</h1>
          <p className="text-gray-500 mt-2">{formation.description}</p>
          <div className="mt-5">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>{t('Progression globale')}</span>
              <span className="font-medium">{progressionPct}%</span>
            </div>
            <div className="bg-gray-100 rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all"
                style={{ width: progressionPct + '%', background: estTerminee ? '#10b981' : 'var(--accent-clinique)' }}
              />
            </div>
          </div>
        </div>

        {/* Modules */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('Modules')}</h2>
          <div className="space-y-3">
            {modules?.map((module: any) => {
              const isTermine = modulesTermines.has(module.id)
              return (
                <Link key={module.id} href={'/formations/' + id + '/module/' + module.id} style={{ textDecoration: 'none' }}>
                  <div className="flex items-center justify-between p-4 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50 transition-colors cursor-pointer" style={{ marginBottom: '8px' }}>
                    <div className="flex items-center gap-3">
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: isTermine ? '#10b981' : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {isTermine ? (
                          <span style={{ color: '#fff', fontSize: '14px' }}>✓</span>
                        ) : (
                          <span style={{ color: '#9ca3af', fontSize: '12px' }}>○</span>
                        )}
                      </div>
                      <span className="font-medium text-gray-900 text-sm">{module.titre}</span>
                    </div>
                    <span className="text-xs text-gray-400">{module.duree_minutes} min</span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Questionnaire */}
        {questionnaire && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">{t('Questionnaire d’évaluation')}</h2>

            {resultatQ ? (
              /* Résultats déjà obtenus */
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', borderRadius: '10px', background: resultatQ.reussi ? '#d1fae5' : '#fee2e2', border: '1px solid ' + (resultatQ.reussi ? '#6ee7b7' : '#fca5a5'), marginBottom: '12px' }}>
                  <span style={{ fontSize: '32px' }}>{resultatQ.reussi ? '🎉' : '📝'}</span>
                  <div>
                    <p style={{ fontWeight: '700', color: resultatQ.reussi ? '#065f46' : '#991b1b', margin: 0, fontSize: '15px' }}>
                      {resultatQ.reussi ? t('Questionnaire réussi !') : t('Questionnaire non réussi')}
                    </p>
                    <p style={{ color: resultatQ.reussi ? '#047857' : '#b91c1c', margin: '2px 0 0', fontSize: '13px' }}>
                      {t('Score obtenu :')} <strong>{resultatQ.score}%</strong> — {t('Seuil requis : {seuil}%', { seuil: questionnaire.note_passage })}
                    </p>
                    <p style={{ color: '#6b7280', margin: '2px 0 0', fontSize: '12px' }}>
                      {resultatQ.created_at ? t('Passé le {date}', { date: formatDate(resultatQ.created_at) }) : ''}
                    </p>
                  </div>
                </div>
                {!resultatQ.reussi && etatQ.tentativesRestantes === 0 && (
                  <p className="text-sm text-red-700">{t('Vous avez utilisé toutes vos tentatives. Contactez votre gestionnaire.')}</p>
                )}
                {!resultatQ.reussi && etatQ.tentativesRestantes !== 0 && (
                  <Link href={'/formations/' + id + '/questionnaire'}>
                    <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2.5 rounded-lg transition text-sm">
                      {t('Repasser le questionnaire')}{etatQ.tentativesRestantes !== null ? ` (${t('{n} tentative(s) restante(s)', { n: etatQ.tentativesRestantes })})` : ''}
                    </button>
                  </Link>
                )}
              </div>
            ) : (
              /* Pas encore passé */
              <div>
                <p className="text-gray-500 text-sm mb-4">
                  {estTerminee
                    ? t('Tous les modules sont complétés. Vous pouvez maintenant passer le questionnaire.')
                    : t('Terminez tous les modules pour débloquer le questionnaire.')}
                </p>
                <Link href={'/formations/' + id + '/questionnaire'}>
                  <button
                    disabled={!estTerminee}
                    className={'px-6 py-2.5 rounded-lg transition text-sm font-semibold ' + (estTerminee ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer' : 'bg-gray-100 text-gray-400 cursor-not-allowed')}
                  >
                    {estTerminee ? t('Passer le questionnaire') : t('Terminez tous les modules d’abord ({pct}%)', { pct: progressionPct })}
                  </button>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Soumettre une preuve externe */}
        <div className="max-w-4xl mx-auto px-6 pb-8" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-yellow-800 text-sm">{t('Vous avez déjà complété cette formation ailleurs ?')}</p>
              <p className="text-yellow-700 text-xs mt-1">{t('Soumettez une preuve externe (certificat, attestation) pour validation.')}</p>
            </div>
            <Link href={'/formations/' + id + '/soumettre-preuve'} className="flex-shrink-0 inline-block bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-semibold text-sm px-4 py-2 rounded-lg transition">
              {t('Soumettre une preuve')}
            </Link>
          </div>
        </div>

      </main>
    </div>
  )
}
