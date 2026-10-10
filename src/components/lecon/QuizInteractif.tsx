'use client'

import { useState } from 'react'
import type { Quiz } from '@/lib/quiz'

/** Quiz côté employé : choix, vérification, correction et explication. */
export default function QuizInteractif({ quiz, titre }: { quiz: Quiz; titre: string | null }) {
  const [choix, setChoix] = useState<(number | null)[]>(() => quiz.questions.map(() => null))
  const [verifie, setVerifie] = useState(false)

  const score = quiz.questions.reduce((s, q, i) => s + (choix[i] === q.bonne_reponse ? 1 : 0), 0)
  const complet = choix.every(c => c !== null)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h3 className="text-lg font-semibold text-gray-900">❓ {titre || 'Vérifiez vos connaissances'}</h3>
        {verifie && (
          <span className={'text-sm font-bold px-3 py-1 rounded-full ' + (score === quiz.questions.length ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>
            {score} / {quiz.questions.length}
          </span>
        )}
      </div>

      <div className="space-y-5">
        {quiz.questions.map((q, i) => (
          <fieldset key={i} className="bg-gray-50 rounded-lg p-4">
            <legend className="sr-only">Question {i + 1}</legend>
            <p className="font-medium text-gray-800 mb-3">{i + 1}. {q.question}</p>
            <div className="space-y-2">
              {q.reponses.map((r, j) => {
                const choisi = choix[i] === j
                const bonne = q.bonne_reponse === j
                const couleur = !verifie ? (choisi ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-100')
                  : bonne ? 'border-green-500 bg-green-50' : choisi ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white opacity-70'
                return (
                  <label key={j} className={'flex items-center gap-3 p-3 rounded-lg border cursor-pointer ' + couleur}>
                    <input type="radio" name={`quiz-${titre}-${i}`} checked={choisi} disabled={verifie}
                      onChange={() => setChoix(c => c.map((x, k) => k === i ? j : x))} className="accent-blue-600" />
                    <span className="text-sm text-gray-700 flex-1">{r}</span>
                    {verifie && bonne && <span className="text-green-600 text-sm font-semibold">✓</span>}
                    {verifie && choisi && !bonne && <span className="text-red-500 text-sm font-semibold">✗</span>}
                  </label>
                )
              })}
            </div>
            {verifie && q.explication && (
              <p className="mt-3 text-sm text-gray-600 bg-white border-l-4 border-blue-400 rounded px-3 py-2">💬 {q.explication}</p>
            )}
          </fieldset>
        ))}
      </div>

      <div className="mt-5 flex gap-3">
        {!verifie ? (
          <button onClick={() => setVerifie(true)} disabled={!complet}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-40">
            Vérifier mes réponses
          </button>
        ) : (
          <button onClick={() => { setVerifie(false); setChoix(quiz.questions.map(() => null)) }}
            className="px-5 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50">
            Recommencer
          </button>
        )}
      </div>
    </div>
  )
}
