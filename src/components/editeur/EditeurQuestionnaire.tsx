'use client'
// Éditeur du questionnaire de fin de formation : questions, réponses (une bonne réponse), points, seuil et tentatives.
import { useEffect, useState } from 'react'
import { useT } from '@/lib/i18n/client'
import type { QuestionEdition } from '@/lib/questionnaire-edition'

const vide = (): QuestionEdition => ({ texte: '', points: 1, reponses: [{ texte: '', est_correcte: true }, { texte: '', est_correcte: false }] })
const champ = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'

export default function EditeurQuestionnaire({ formationId, titreFormation }: { formationId: string; titreFormation: string }) {
  const { t } = useT()
  const [charge, setCharge] = useState(false)
  const [titre, setTitre] = useState('')
  const [seuil, setSeuil] = useState(80)
  const [tentatives, setTentatives] = useState<string>('3')
  const [questions, setQuestions] = useState<QuestionEdition[]>([])
  const [dejaPasses, setDejaPasses] = useState(0)
  const [etat, setEtat] = useState<'' | 'envoi' | 'ok'>('')
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/admin/formations/${formationId}/questionnaire`).then(async r => {
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setErreur(d.error ?? t('Chargement impossible')); setCharge(true); return }
      const q = d.questionnaire
      setTitre(q?.titre ?? t('Questionnaire - {titre}', { titre: titreFormation }))
      setSeuil(q?.note_passage ?? 80)
      setTentatives(q?.nb_tentatives_max == null ? (q ? '' : '3') : String(q.nb_tentatives_max))
      setQuestions(q?.questions ?? [])
      setDejaPasses(d.tentatives ?? 0)
      setCharge(true)
    })
  }, [formationId, titreFormation, t])

  const majQ = (i: number, c: Partial<QuestionEdition>) => { setEtat(''); setQuestions(qs => qs.map((q, j) => (j === i ? { ...q, ...c } : q))) }
  const majR = (i: number, k: number, texte: string) => majQ(i, { reponses: questions[i].reponses.map((r, j) => (j === k ? { ...r, texte } : r)) })
  const bonne = (i: number, k: number) => majQ(i, { reponses: questions[i].reponses.map((r, j) => (j === k ? { ...r, est_correcte: !r.est_correcte } : r)) })
  const deplacer = (i: number, d: -1 | 1) => setQuestions(qs => { const n = [...qs]; const j = i + d; if (j < 0 || j >= n.length) return qs; [n[i], n[j]] = [n[j], n[i]]; return n })

  const enregistrer = async () => {
    setEtat('envoi'); setErreur(null)
    const r = await fetch(`/api/admin/formations/${formationId}/questionnaire`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titre, note_passage: seuil, nb_tentatives_max: tentatives === '' ? null : Number(tentatives), questions }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { setEtat(''); setErreur(d.error ?? t('Enregistrement impossible')); return }
    setEtat('ok')
  }

  if (!charge) return <p className="text-sm text-gray-500">{t('Chargement...')}</p>

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{t('Questionnaire de fin de formation')}</h2>
          <p className="text-sm text-gray-500">{t('L’employé y accède après avoir terminé tous les modules. Cochez la ou les bonnes réponses : l’employé en choisit une, et toute réponse cochée est acceptée.')}</p>
        </div>
      </div>
      {dejaPasses > 0 && (
        <p className="mb-4 text-sm rounded-lg bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2">
          {t('{n} tentative(s) déjà passée(s). Les résultats obtenus restent valides ; les nouvelles tentatives utiliseront la version modifiée.', { n: dejaPasses })}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3 bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <div className="sm:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('Titre du questionnaire')}</label>
          <input value={titre} onChange={e => { setTitre(e.target.value); setEtat('') }} className={champ} maxLength={200} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('Seuil de réussite (%)')}</label>
          <input type="number" min={1} max={100} value={seuil} onChange={e => { setSeuil(Number(e.target.value)); setEtat('') }} className={champ} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('Tentatives maximum')}</label>
          <input type="number" min={1} max={50} value={tentatives} onChange={e => { setTentatives(e.target.value); setEtat('') }} placeholder={t('Illimité')} className={champ} />
        </div>
        <div className="text-xs text-gray-500 self-end pb-2">{t('Laissez vide pour un nombre illimité de tentatives.')}</div>
      </div>

      <div className="space-y-3">
        {questions.map((q, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 rounded px-2 py-0.5">Q{i + 1}</span>
              <span className="flex-1" />
              <label className="text-xs text-gray-500 flex items-center gap-1">{t('Points')}
                <input type="number" min={1} max={100} value={q.points} onChange={e => majQ(i, { points: Number(e.target.value) || 1 })} className="w-16 border border-gray-300 rounded px-2 py-1 text-xs" />
              </label>
              <button type="button" onClick={() => deplacer(i, -1)} aria-label={t('Monter')} className="px-1 text-gray-500">↑</button>
              <button type="button" onClick={() => deplacer(i, 1)} aria-label={t('Descendre')} className="px-1 text-gray-500">↓</button>
              <button type="button" onClick={() => { setEtat(''); setQuestions(qs => qs.filter((_, j) => j !== i)) }} className="text-xs text-red-600">{t('Supprimer la question')}</button>
            </div>
            <textarea value={q.texte} onChange={e => majQ(i, { texte: e.target.value })} rows={2} placeholder={t('Écrivez la question…')} className={champ} />
            <div className="mt-2 space-y-1.5">
              {q.reponses.map((r, k) => (
                <div key={k} className="flex items-center gap-2">
                  <input type="checkbox" checked={r.est_correcte} onChange={() => bonne(i, k)} title={t('Bonne réponse')} />
                  <input value={r.texte} onChange={e => majR(i, k, e.target.value)} placeholder={t('Réponse {n}', { n: k + 1 })}
                    className={'flex-1 border rounded-lg px-3 py-1.5 text-sm ' + (r.est_correcte ? 'border-green-400 bg-green-50' : 'border-gray-300')} />
                  {q.reponses.length > 2 && <button type="button" onClick={() => majQ(i, { reponses: q.reponses.filter((_, j) => j !== k) })} className="text-gray-400 hover:text-red-600" aria-label={t('Supprimer')}>×</button>}
                </div>
              ))}
              <button type="button" onClick={() => majQ(i, { reponses: [...q.reponses, { texte: '', est_correcte: false }] })} className="text-xs font-semibold text-indigo-600">{t('+ Ajouter une réponse')}</button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => { setEtat(''); setQuestions(qs => [...qs, vide()]) }} className="px-4 py-2 text-sm rounded-lg border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100">{t('+ Ajouter une question')}</button>
        <span className="flex-1" />
        {etat === 'ok' && <span className="text-sm text-green-700">{t('✓ Enregistré')}</span>}
        <button type="button" onClick={enregistrer} disabled={etat === 'envoi'} className="px-5 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white disabled:opacity-50">
          {etat === 'envoi' ? t('Enregistrement…') : t('Enregistrer le questionnaire')}
        </button>
      </div>
      {questions.length === 0 && <p className="mt-3 text-xs text-gray-500">{t('Sans question, la formation n’a pas de questionnaire et aucun certificat n’est émis.')}</p>}
      {erreur && <p className="mt-3 text-sm rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2">{erreur}</p>}
    </div>
  )
}
