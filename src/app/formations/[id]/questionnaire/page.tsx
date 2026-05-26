'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Question {
  id: string
  texte: string
  type: string
  ordre: number
  reponses_possibles: { id: string; texte: string; est_correcte: boolean }[]
}

interface Questionnaire {
  id: string
  titre: string
  seuil_reussite: number
  formation_id: string
}

export default function QuestionnairePage() {
  const params = useParams()
  const router = useRouter()
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [reponses, setReponses] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ score: number; passed: boolean; certificatId?: string } | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: q } = await supabase
        .from('questionnaires')
        .select('*')
        .eq('formation_id', params.id as string)
        .single()

      if (!q) { setLoading(false); return }
      setQuestionnaire(q)

      const { data: qs } = await supabase
        .from('questions')
        .select('*, reponses_possibles(*)')
        .eq('questionnaire_id', q.id)
        .order('ordre')

      if (qs) setQuestions(qs)
      setLoading(false)
    }
    loadData()
  }, [params.id])

  async function handleSubmit() {
    if (!questionnaire) return
    setSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: emp } = await supabase.from('employes').select('id').eq('auth_user_id', user.id).single()
    if (!emp) return

    let correct = 0
    questions.forEach(q => {
      const chosen = reponses[q.id]
      const correctReponse = q.reponses_possibles.find(r => r.est_correcte)
      if (chosen && correctReponse && chosen === correctReponse.id) correct++
    })

    const score = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0
    const passed = score >= questionnaire.seuil_reussite

    const { data: tentative } = await supabase.from('tentatives_questionnaire').insert({
      employe_id: emp.id,
      questionnaire_id: questionnaire.id,
      score,
      reponses_donnees: JSON.stringify(reponses),
      reussi: passed,
    }).select().single()

    let certificatId: string | undefined
    if (passed) {
      const { data: cert } = await supabase.from('certificats').insert({
        employe_id: emp.id,
        formation_id: params.id as string,
        score_obtenu: score,
        date_expiration: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      }).select().single()
      if (cert) certificatId = cert.id
    }

    setResult({ score, passed, certificatId })
    setSubmitting(false)
  }

  if (loading) return <div className="flex justify-center items-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>

  if (result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className={`text-6xl mb-4`}>{result.passed ? '🎉' : '📚'}</div>
          <h2 className="text-2xl font-bold mb-2">{result.passed ? 'Félicitations!' : 'Continuez vos efforts!'}</h2>
          <p className="text-gray-600 mb-4">Votre score: <span className={`font-bold text-2xl ${result.passed ? 'text-green-600' : 'text-red-500'}`}>{result.score}%</span></p>
          <p className="text-gray-500 text-sm mb-6">Seuil de réussite: {questionnaire?.seuil_reussite}%</p>
          {result.passed && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-green-700 font-medium">Certificat généré avec succès!</p>
              <button onClick={() => router.push('/certificats')} className="mt-2 text-green-600 underline text-sm">Voir mes certificats</button>
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <button onClick={() => router.push(`/formations/${params.id}`)} className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">Retour à la formation</button>
            {!result.passed && <button onClick={() => { setResult(null); setReponses({}) }} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Recommencer</button>}
          </div>
        </div>
      </div>
    )
  }

  if (!questionnaire || questions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Aucun questionnaire disponible pour cette formation.</p>
          <button onClick={() => router.push(`/formations/${params.id}`)} className="text-blue-600 hover:underline">Retour</button>
        </div>
      </div>
    )
  }

  const answered = Object.keys(reponses).length
  const progress = Math.round((answered / questions.length) * 100)

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="font-semibold text-gray-900">{questionnaire.titre}</h1>
          <span className="text-sm text-gray-500">{answered}/{questions.length} répondues</span>
        </div>
        <div className="h-1 bg-gray-200">
          <div className="h-1 bg-blue-600 transition-all" style={{ width: `${progress}%` }}></div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {questions.map((q, idx) => (
          <div key={q.id} className="bg-white rounded-xl shadow-sm border p-6">
            <p className="font-medium text-gray-900 mb-4">{idx + 1}. {q.texte}</p>
            <div className="space-y-3">
              {q.reponses_possibles.map(r => (
                <label key={r.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${reponses[q.id] === r.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
                  <input
                    type="radio"
                    name={q.id}
                    value={r.id}
                    checked={reponses[q.id] === r.id}
                    onChange={() => setReponses(prev => ({ ...prev, [q.id]: r.id }))}
                    className="text-blue-600"
                  />
                  <span className="text-gray-700">{r.texte}</span>
                </label>
              ))}
            </div>
          </div>
        ))}

        <button
          onClick={handleSubmit}
          disabled={answered < questions.length || submitting}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {submitting ? 'Correction en cours...' : answered < questions.length ? `Répondre à toutes les questions (${questions.length - answered} restantes)` : 'Soumettre mes réponses'}
        </button>
      </div>
    </div>
  )
}