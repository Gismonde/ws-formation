'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface ModuleForm {
  titre: string
  contenu: string
  duree_minutes: number
  ordre: number
}

interface QuestionForm {
  texte: string
  reponses: { texte: string; est_correcte: boolean }[]
}

export default function NouvelleFormationPage() {
  const router = useRouter()
  const supabase = createClient()

  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  const [niveau, setNiveau] = useState('debutant')
  const [dureeHeures, setDureeHeures] = useState(1)
  const [modules, setModules] = useState<ModuleForm[]>([{ titre: '', contenu: '', duree_minutes: 30, ordre: 1 }])
  const [questions, setQuestions] = useState<QuestionForm[]>([
    { texte: '', reponses: [{ texte: '', est_correcte: true }, { texte: '', est_correcte: false }, { texte: '', est_correcte: false }] }
  ])
  const [seuilReussite, setSeuilReussite] = useState(70)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function addModule() {
    setModules(prev => [...prev, { titre: '', contenu: '', duree_minutes: 30, ordre: prev.length + 1 }])
  }

  function removeModule(idx: number) {
    setModules(prev => prev.filter((_, i) => i !== idx).map((m, i) => ({ ...m, ordre: i + 1 })))
  }

  function updateModule(idx: number, field: keyof ModuleForm, value: string | number) {
    setModules(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m))
  }

  function addQuestion() {
    setQuestions(prev => [...prev, { texte: '', reponses: [{ texte: '', est_correcte: true }, { texte: '', est_correcte: false }, { texte: '', est_correcte: false }] }])
  }

  function removeQuestion(idx: number) {
    setQuestions(prev => prev.filter((_, i) => i !== idx))
  }

  function updateQuestion(qIdx: number, texte: string) {
    setQuestions(prev => prev.map((q, i) => i === qIdx ? { ...q, texte } : q))
  }

  function updateReponse(qIdx: number, rIdx: number, texte: string) {
    setQuestions(prev => prev.map((q, i) => i === qIdx ? {
      ...q,
      reponses: q.reponses.map((r, j) => j === rIdx ? { ...r, texte } : r)
    } : q))
  }

  function setCorrect(qIdx: number, rIdx: number) {
    setQuestions(prev => prev.map((q, i) => i === qIdx ? {
      ...q,
      reponses: q.reponses.map((r, j) => ({ ...r, est_correcte: j === rIdx }))
    } : q))
  }

  function addReponse(qIdx: number) {
    setQuestions(prev => prev.map((q, i) => i === qIdx ? {
      ...q,
      reponses: [...q.reponses, { texte: '', est_correcte: false }]
    } : q))
  }

  async function handleSave() {
    if (!titre.trim()) { setError('Le titre est requis.'); return }
    if (modules.some(m => !m.titre.trim())) { setError('Tous les modules doivent avoir un titre.'); return }
    setSaving(true)
    setError('')

    try {
      const { data: formation, error: fErr } = await supabase.from('formations').insert({
        titre,
        description,
        niveau,
        duree_heures: dureeHeures,
        est_publiee: false,
      }).select().single()

      if (fErr || !formation) { setError(fErr?.message || 'Erreur lors de la création.'); setSaving(false); return }

      // Insert modules
      if (modules.length > 0) {
        const { error: mErr } = await supabase.from('modules').insert(
          modules.map(m => ({ ...m, formation_id: formation.id }))
        )
        if (mErr) { setError(mErr.message); setSaving(false); return }
      }

      // Insert questionnaire + questions
      if (questions.length > 0) {
        const { data: questionnaire, error: qErr } = await supabase.from('questionnaires').insert({
          formation_id: formation.id,
          titre: `Questionnaire - ${titre}`,
          seuil_reussite: seuilReussite,
        }).select().single()

        if (!qErr && questionnaire) {
          for (let i = 0; i < questions.length; i++) {
            const q = questions[i]
            if (!q.texte.trim()) continue
            const { data: question } = await supabase.from('questions').insert({
              questionnaire_id: questionnaire.id,
              texte: q.texte,
              type: 'qcm',
              ordre: i + 1,
            }).select().single()

            if (question) {
              await supabase.from('reponses_possibles').insert(
                q.reponses.filter(r => r.texte.trim()).map(r => ({ question_id: question.id, texte: r.texte, est_correcte: r.est_correcte }))
              )
            }
          }
        }
      }

      router.push('/admin/formations')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur inattendue')
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Nouvelle formation</h1>
            <p className="text-gray-500 mt-1">Créez une nouvelle formation pour vos employés</p>
          </div>
          <button onClick={() => router.push('/admin/formations')} className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">Annuler</button>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-6">{error}</div>}

        {/* Infos générales */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Informations générales</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
              <input type="text" value={titre} onChange={e => setTitre(e.target.value)} className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Ex: Sécurité au travail" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Description de la formation..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Niveau</label>
                <select value={niveau} onChange={e => setNiveau(e.target.value)} className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500">
                  <option value="debutant">Débutant</option>
                  <option value="intermediaire">Intermédiaire</option>
                  <option value="avance">Avancé</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Durée (heures)</label>
                <input type="number" value={dureeHeures} onChange={e => setDureeHeures(Number(e.target.value))} min={1} className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Modules */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Modules de contenu</h2>
            <button onClick={addModule} className="text-sm text-blue-600 hover:text-blue-700 font-medium">+ Ajouter un module</button>
          </div>
          <div className="space-y-4">
            {modules.map((mod, idx) => (
              <div key={idx} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">Module {mod.ordre}</span>
                  {modules.length > 1 && <button onClick={() => removeModule(idx)} className="text-red-500 hover:text-red-700 text-sm">Supprimer</button>}
                </div>
                <div className="space-y-3">
                  <input type="text" value={mod.titre} onChange={e => updateModule(idx, 'titre', e.target.value)} className="w-full border rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500" placeholder="Titre du module" />
                  <textarea value={mod.contenu} onChange={e => updateModule(idx, 'contenu', e.target.value)} rows={4} className="w-full border rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500" placeholder="Contenu du module (texte, instructions, procédures...)" />
                  <div>
                    <label className="text-sm text-gray-600">Durée estimée (minutes)</label>
                    <input type="number" value={mod.duree_minutes} onChange={e => updateModule(idx, 'duree_minutes', Number(e.target.value))} min={5} className="ml-3 w-24 border rounded px-2 py-1 text-sm bg-white" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Questionnaire */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Questionnaire de compétence</h2>
            <button onClick={addQuestion} className="text-sm text-blue-600 hover:text-blue-700 font-medium">+ Ajouter une question</button>
          </div>
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700">Seuil de réussite (%)</label>
            <input type="number" value={seuilReussite} onChange={e => setSeuilReussite(Number(e.target.value))} min={0} max={100} className="ml-3 w-20 border rounded px-2 py-1 text-sm" />
          </div>
          <div className="space-y-6">
            {questions.map((q, qIdx) => (
              <div key={qIdx} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">Question {qIdx + 1}</span>
                  {questions.length > 1 && <button onClick={() => removeQuestion(qIdx)} className="text-red-500 hover:text-red-700 text-sm">Supprimer</button>}
                </div>
                <input type="text" value={q.texte} onChange={e => updateQuestion(qIdx, e.target.value)} className="w-full border rounded-lg px-3 py-2 bg-white mb-3 focus:ring-2 focus:ring-blue-500" placeholder="Texte de la question" />
                <div className="space-y-2">
                  {q.reponses.map((r, rIdx) => (
                    <div key={rIdx} className="flex items-center gap-3">
                      <input type="radio" name={`correct-${qIdx}`} checked={r.est_correcte} onChange={() => setCorrect(qIdx, rIdx)} className="text-blue-600 mt-1" />
                      <input type="text" value={r.texte} onChange={e => updateReponse(qIdx, rIdx, e.target.value)} className="flex-1 border rounded px-3 py-1.5 bg-white text-sm focus:ring-2 focus:ring-blue-500" placeholder={`Réponse ${rIdx + 1}`} />
                      {r.est_correcte && <span className="text-xs text-green-600 font-medium">Correcte</span>}
                    </div>
                  ))}
                  <button onClick={() => addReponse(qIdx)} className="text-xs text-gray-500 hover:text-gray-700 mt-1">+ Réponse</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button onClick={() => router.push('/admin/formations')} className="px-6 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">Annuler</button>
          <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
            {saving ? 'Enregistrement...' : 'Créer la formation'}
          </button>
        </div>
      </div>
    </div>
  )
}