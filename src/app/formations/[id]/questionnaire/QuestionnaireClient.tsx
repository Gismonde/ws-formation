'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n/client'

export type QuestionAffichee = { id: string; texte: string; reponses: { id: string; texte: string }[] }

type Resultat = {
  score: number
  reussi: boolean
  seuil: number
  certificatId: string | null
  tentativesRestantes: number | null
  correction: Record<string, { correcte: boolean; bonne_reponse?: string }>
}

export default function QuestionnaireClient({ formationId, titre, seuil, tentativesRestantes, tentativesFaites, questions }: {
  formationId: string
  titre: string
  seuil: number
  tentativesRestantes: number | null
  tentativesFaites: number
  questions: QuestionAffichee[]
}) {
  const router = useRouter()
  const { t } = useT()
  const debut = useMemo(() => new Date().toISOString(), [])
  const [reponses, setReponses] = useState<Record<string, string>>({})
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState('')
  const [resultat, setResultat] = useState<Resultat | null>(null)

  const repondues = Object.keys(reponses).length
  const progression = Math.round((repondues / questions.length) * 100)

  async function soumettre() {
    setEnvoi(true); setErreur('')
    try {
      const res = await fetch(`/api/formations/${formationId}/questionnaire`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reponses, debut }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setErreur(d.error ?? t('Erreur')); return }
      setResultat(d)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setErreur(t('Erreur réseau. Vos réponses n’ont pas été envoyées.'))
    } finally {
      setEnvoi(false)
    }
  }

  const corrige = resultat?.correction

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <h1 className="font-semibold text-gray-900 truncate">{titre}</h1>
          <span className="text-sm text-gray-500 whitespace-nowrap">{t('{n}/{total} répondues', { n: repondues, total: questions.length })}</span>
        </div>
        <div className="h-1 bg-gray-200"><div className="h-1 bg-blue-600 transition-all" style={{ width: `${progression}%` }} /></div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {resultat ? (
          <div className="bg-white rounded-2xl shadow-sm border p-8 text-center">
            <div className="text-5xl mb-3">{resultat.reussi ? '🎉' : '📚'}</div>
            <h2 className="text-2xl font-bold mb-2">{resultat.reussi ? t('Félicitations !') : t('Questionnaire non réussi')}</h2>
            <p className="text-gray-600">
              {t('Votre score :')} <span className={`font-bold text-2xl ${resultat.reussi ? 'text-green-600' : 'text-red-500'}`}>{resultat.score} %</span>
            </p>
            <p className="text-gray-500 text-sm mt-1 mb-5">{t('Seuil de réussite : {seuil} %', { seuil: resultat.seuil })}</p>
            {resultat.reussi ? (
              resultat.certificatId ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-5">
                  <p className="text-green-700 font-medium">{t('Votre certificat a été émis.')}</p>
                  <button onClick={() => router.push(`/certificat/${resultat.certificatId}`)} className="mt-2 text-green-700 underline text-sm">{t('Voir mon certificat')}</button>
                </div>
              ) : (
                <p className="text-amber-700 text-sm mb-5">{t('Réussite enregistrée, mais le certificat n’a pas pu être émis. L’incident est noté dans le journal ; contactez votre gestionnaire.')}</p>
              )
            ) : (
              <p className="text-gray-600 text-sm mb-5">
                {t('Les questions en rouge ci-dessous sont à revoir.')}{' '}
                {resultat.tentativesRestantes === null ? t('Vous pouvez réessayer.')
                  : resultat.tentativesRestantes > 0 ? t('Il vous reste {n} tentative(s).', { n: resultat.tentativesRestantes })
                  : t('Vous n’avez plus de tentatives : contactez votre gestionnaire.')}
              </p>
            )}
            <div className="flex flex-wrap gap-3 justify-center">
              <button onClick={() => router.push(`/formations/${formationId}`)} className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">{t('Retour à la formation')}</button>
              {!resultat.reussi && (resultat.tentativesRestantes === null || resultat.tentativesRestantes > 0) && (
                <button onClick={() => { setResultat(null); setReponses({}); router.refresh() }} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{t('Recommencer')}</button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-3 text-sm text-blue-900">
            {t('Seuil de réussite :')} <b>{seuil} %</b>
            {tentativesRestantes !== null && <> · {t('Tentative {n} sur {total}', { n: tentativesFaites + 1, total: tentativesFaites + tentativesRestantes })}</>}
          </div>
        )}

        {questions.map((q, idx) => {
          const c = corrige?.[q.id]
          return (
            <div key={q.id} className={'bg-white rounded-xl shadow-sm border p-6 ' + (c ? (c.correcte ? 'border-green-300' : 'border-red-300') : '')}>
              <p className="font-medium text-gray-900 mb-4">
                {c && <span className="mr-2">{c.correcte ? '✅' : '❌'}</span>}
                {idx + 1}. {q.texte}
              </p>
              <div className="space-y-3">
                {q.reponses.map(r => {
                  const choisie = reponses[q.id] === r.id
                  const estBonne = c?.bonne_reponse === r.id
                  return (
                    <label key={r.id} className={'flex items-center gap-3 p-3 rounded-lg border transition ' +
                      (resultat ? 'cursor-default ' : 'cursor-pointer ') +
                      (estBonne ? 'border-green-500 bg-green-50' : choisie ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50')}>
                      <input type="radio" name={q.id} value={r.id} checked={choisie} disabled={!!resultat}
                        onChange={() => setReponses(prev => ({ ...prev, [q.id]: r.id }))} className="text-blue-600" />
                      <span className="text-gray-700">{r.texte}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          )
        })}

        {!resultat && (
          <>
            {erreur && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{erreur}</div>}
            <button onClick={soumettre} disabled={repondues < questions.length || envoi}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition">
              {envoi ? t('Correction en cours…') : repondues < questions.length ? t('Répondez à toutes les questions ({n} restante(s))', { n: questions.length - repondues }) : t('Soumettre mes réponses')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
