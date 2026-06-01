'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const CATEGORIES = [
  'Administration médicale',
  'Gestion des soins',
  'Hygiène et sécurité',
  'Ressources humaines',
  'Qualité et conformité',
  'Informatique et systèmes',
  'Formation du personnel',
  'Gestion des risques',
  'Communication',
]

interface LeconData {
  titre: string
  description: string
  image_url?: string
}

interface ModuleForm {
  titre: string
  contenu: string
  duree_minutes: number
  ordre: number
  lecons: LeconData[]
}

interface QuestionForm {
  texte: string
  reponses: { texte: string; est_correcte: boolean }[]
}

export default function NouvelleFormationPage() {
  const router = useRouter()
  const [titre, setTitre] = useState('')
  const [categorie, setCategorie] = useState('Administration médicale')
  const [description, setDescription] = useState('')
  const [niveau, setNiveau] = useState('debutant')
  const [dureeHeures, setDureeHeures] = useState(1)
  const [modules, setModules] = useState<ModuleForm[]>([{ titre: '', contenu: '', duree_minutes: 30, ordre: 1, lecons: [] }])
  const [questions, setQuestions] = useState<QuestionForm[]>([
    { texte: '', reponses: [{ texte: '', est_correcte: true }, { texte: '', est_correcte: false }, { texte: '', est_correcte: false }] }
  ])
  const [seuilReussite, setSeuilReussite] = useState(70)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const addModule = () => {
    setModules(prev => [...prev, { titre: '', contenu: '', duree_minutes: 30, ordre: prev.length + 1, lecons: [] }])
  }

  const removeModule = (idx: number) => {
    setModules(prev => prev.filter((_, i) => i !== idx).map((m, i) => ({ ...m, ordre: i + 1 })))
  }

  const updateModule = (idx: number, field: keyof ModuleForm, value: string | number) => {
    setModules(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m))
  }

  const handleLeconImageUpload = async (file: File, moduleIdx: number, leconIdx: number) => {
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/upload-lesson-image', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.url) {
        const updated = [...modules]
        updated[moduleIdx].lecons[leconIdx] = { ...updated[moduleIdx].lecons[leconIdx], image_url: data.url }
        setModules(updated)
      }
    } catch (err) {
      console.error('Image upload error:', err)
    }
  }

  const addQuestion = () => {
    setQuestions(prev => [...prev, { texte: '', reponses: [{ texte: '', est_correcte: true }, { texte: '', est_correcte: false }, { texte: '', est_correcte: false }] }])
  }

  const removeQuestion = (idx: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== idx))
  }

    // Restore draft from localStorage
  useEffect(() => {
    try {
      const draft = localStorage.getItem('nouvelle-formation-draft')
      if (draft) {
        const saved = JSON.parse(draft)
        if (saved.titre) setTitre(saved.titre)
        if (saved.description) setDescription(saved.description)
        if (saved.categorie) setCategorie(saved.categorie)
        if (saved.niveau) setNiveau(saved.niveau)
        if (saved.dureeHeures) setDureeHeures(saved.dureeHeures)
        if (saved.modules && saved.modules.length > 0) setModules(saved.modules)
        if (saved.questions && saved.questions.length > 0) setQuestions(saved.questions)
        if (saved.seuilReussite) setSeuilReussite(saved.seuilReussite)
      }
    } catch {}
  }, [])

  // Auto-save draft
  useEffect(() => {
    if (titre || modules.some(m => m.titre)) {
      try {
        localStorage.setItem('nouvelle-formation-draft', JSON.stringify({ titre, description, categorie, niveau, dureeHeures, modules, questions, seuilReussite }))
      } catch {}
    }
  }, [titre, description, categorie, niveau, dureeHeures, modules, questions, seuilReussite])

  async function handleSave() {
    if (!titre.trim()) { setError('Le titre est requis.'); return }
    setSaving(true)
    setError('')
    const supabase = createClient()

    try {
      const { data: formation, error: errF } = await supabase
        .from('formations')
        .insert({
          titre,
          categorie,
          description,
          niveau,
          duree_heures: dureeHeures,
          est_publiee: false,
        })
        .select()
        .single()
      if (errF || !formation) throw new Error(errF?.message || 'Erreur création formation')

      const { data: modulesCreated, error: errM } = await supabase
        .from('modules')
        .insert(
          modules.map(m => ({ titre: m.titre, contenu: m.contenu, duree_minutes: m.duree_minutes, ordre: m.ordre, formation_id: formation.id }))
        )
        .select()
      if (errM) throw new Error(errM.message)

      // Insert leçons pour chaque module
      if (modulesCreated) {
        for (let mIdx = 0; mIdx < modules.length; mIdx++) {
          const mod = modules[mIdx]
          const createdMod = modulesCreated[mIdx]
          if (!createdMod || !mod.lecons || mod.lecons.length === 0) continue
          const { error: errL } = await supabase
            .from('lecons')
            .insert(
              mod.lecons.map((l, lIdx) => ({
                module_id: createdMod.id,
                titre: l.titre || ('Leçon ' + (lIdx + 1)),
                description: l.description || '',
                image_url: l.image_url || null,
                ordre: lIdx + 1,
                est_obligatoire: true,
              }))
            )
          if (errL) console.error('Erreur insert leçons:', errL.message)

          // Insert blocs_contenu for each leçon with description
          if (!errL) {
            const { data: insertedLecons } = await supabase
              .from('lecons')
              .select('id, ordre')
              .eq('module_id', createdMod.id)
              .order('ordre')
            
            if (insertedLecons) {
              const blocsToInsert = insertedLecons
                .map((lecon, lIdx) => {
                  const desc = mod.lecons[lIdx]?.description?.trim()
                  if (!desc) return null
                  return { lecon_id: lecon.id, type: 'texte', contenu: desc, ordre: 1 }
                })
                .filter(Boolean)
              
              if (blocsToInsert.length > 0) {
                await supabase.from('blocs_contenu').insert(blocsToInsert)
              }
            }
          }
        }
      }

      const validQuestions = questions.filter(q => q.texte.trim())
      if (validQuestions.length > 0) {
        const { data: questionnaire, error: errQ } = await supabase
          .from('questionnaires')
          .insert({
            formation_id: formation.id,
            titre: 'Questionnaire - ' + titre,
            seuil_reussite: seuilReussite,
          })
          .select()
          .single()
        if (errQ || !questionnaire) throw new Error(errQ?.message || 'Erreur questionnaire')

        for (let i = 0; i < validQuestions.length; i++) {
          const q = validQuestions[i]
          const { data: question, error: errQu } = await supabase
            .from('questions')
            .insert({
              questionnaire_id: questionnaire.id,
              texte: q.texte,
              type: 'qcm',
              ordre: i + 1,
            })
            .select()
            .single()
          if (errQu || !question) continue
          const validReponses = q.reponses.filter(r => r.texte.trim())
          if (validReponses.length > 0) {
            await supabase
              .from('reponses_possibles')
              .insert(
                validReponses.filter(r => r.texte.trim()).map((r, ri) => ({
                  question_id: question.id,
                  texte: r.texte,
                  est_correcte: r.est_correcte,
                  ordre: ri + 1,
                }))
              )
          }
        }
      }

      localStorage.removeItem('nouvelle-formation-draft')
      router.push('/admin/formations/' + formation.id)
    } catch (err: any) {
      setError(err.message)
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '13px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '4px',
  }
  const btnStyle: React.CSSProperties = {
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 18px',
    fontSize: '14px',
    cursor: 'pointer',
    fontWeight: '600',
  }
  const btnSecStyle: React.CSSProperties = {
    background: '#f3f4f6',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '13px',
    cursor: 'pointer',
  }
  const btnDangerStyle: React.CSSProperties = {
    background: '#fee2e2',
    color: '#991b1b',
    border: 'none',
    borderRadius: '4px',
    padding: '3px 8px',
    fontSize: '12px',
    cursor: 'pointer',
  }

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 20px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ marginBottom: '24px' }}>
        <a href="/admin/formations" style={{ color: '#6b7280', fontSize: '14px', textDecoration: 'none' }}>← Retour</a>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: '8px 0 0' }}>Nouvelle formation</h1>
      </div>

      {error && <p style={{ color: '#dc2626', background: '#fee2e2', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' }}>{error}</p>}

      {/* Informations générales */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '24px', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px', color: '#111827' }}>Informations générales</h2>
        <div style={{ display: 'grid', gap: '14px' }}>
          <div>
            <label style={labelStyle}>Titre *</label>
            <input style={inputStyle} value={titre} onChange={e => setTitre(e.target.value)} placeholder="Titre de la formation" />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }} value={description} onChange={e => setDescription(e.target.value)} placeholder="Description..." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Catégorie</label>
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={categorie} onChange={e => setCategorie(e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Niveau</label>
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={niveau} onChange={e => setNiveau(e.target.value)}>
                <option value="debutant">Débutant</option>
                <option value="intermediaire">Intermédiaire</option>
                <option value="avance">Avancé</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Durée (heures)</label>
              <input style={inputStyle} type="number" min={1} max={40} value={dureeHeures} onChange={e => setDureeHeures(Number(e.target.value))} />
            </div>
          </div>
        </div>
      </div>

      {/* Modules */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '700', margin: 0, color: '#111827' }}>Modules ({modules.length})</h2>
          <button onClick={addModule} style={{ ...btnStyle, padding: '6px 12px', fontSize: '13px' }}>+ Module</button>
        </div>

        {modules.map((mod, idx) => (
          <div key={idx} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '14px', marginBottom: '10px', background: '#f9fafb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#6b7280' }}>Module {idx + 1}</span>
              <button onClick={() => removeModule(idx)} style={btnDangerStyle}>Supprimer</button>
            </div>
            <div style={{ display: 'grid', gap: '8px' }}>
              <div>
                <label style={{ ...labelStyle, fontSize: '12px' }}>Titre *</label>
                <input style={inputStyle} value={mod.titre} onChange={e => updateModule(idx, 'titre', e.target.value)} placeholder="Titre du module" />
              </div>
              <div>
                <label style={{ ...labelStyle, fontSize: '12px' }}>Contenu</label>
                <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical', fontSize: '13px' }} value={mod.contenu} onChange={e => updateModule(idx, 'contenu', e.target.value)} placeholder="Contenu du module..." />
              </div>
              <div style={{ maxWidth: '160px' }}>
                <label style={{ ...labelStyle, fontSize: '12px' }}>Durée (min)</label>
                <input style={inputStyle} type="number" min={5} max={480} value={mod.duree_minutes} onChange={e => updateModule(idx, 'duree_minutes', Number(e.target.value))} />
              </div>

              {/* Leçons */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ ...labelStyle, fontSize: '12px', marginBottom: 0 }}>Leçons</label>
                  <button
                    onClick={() => {
                      const updated = [...modules]
                      updated[idx] = { ...updated[idx], lecons: [...(updated[idx].lecons || []), { titre: '', description: '' }] }
                      setModules(updated)
                    }}
                    style={{ ...btnSecStyle, fontSize: '11px', padding: '2px 8px' }}
                  >
                    + Leçon
                  </button>
                </div>
                {(mod.lecons || []).length === 0 && (
                  <p style={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', margin: '4px 0' }}>Aucune leçon</p>
                )}
                {(mod.lecons || []).map((lecon, leconIdx) => {
                  const leconImgId = 'img-nv-' + idx + '-' + leconIdx
                  return (
                    <div key={leconIdx} style={{ border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px', marginBottom: '6px', background: '#fff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280' }}>Leçon {leconIdx + 1}</span>
                        <button
                          onClick={() => {
                            const updated = [...modules]
                            updated[idx].lecons = updated[idx].lecons.filter((_, i) => i !== leconIdx)
                            setModules(updated)
                          }}
                          style={{ ...btnDangerStyle, fontSize: '10px', padding: '1px 6px' }}
                        >
                          Supprimer
                        </button>
                      </div>
                      <input
                        style={{ ...inputStyle, marginBottom: '4px', fontSize: '12px' }}
                        value={lecon.titre}
                        onChange={e => {
                          const updated = [...modules]
                          updated[idx].lecons[leconIdx] = { ...updated[idx].lecons[leconIdx], titre: e.target.value }
                          setModules(updated)
                        }}
                        placeholder="Titre de la leçon"
                      />
                      <textarea
                        style={{ ...inputStyle, minHeight: '55px', resize: 'vertical', fontSize: '12px' }}
                        value={lecon.description}
                        onChange={e => {
                          const updated = [...modules]
                          updated[idx].lecons[leconIdx] = { ...updated[idx].lecons[leconIdx], description: e.target.value }
                          setModules(updated)
                        }}
                        placeholder="Description de la leçon..."
                      />
                      <div style={{ marginTop: '6px' }}>
                        {lecon.image_url ? (
                          <div>
                            <img src={lecon.image_url} alt="Aperçu" style={{ maxWidth: '160px', maxHeight: '100px', borderRadius: '4px', border: '1px solid #d1d5db', display: 'block' }} />
                            <button
                              onClick={() => {
                                const updated = [...modules]
                                const lec = { ...updated[idx].lecons[leconIdx] }
                                delete lec.image_url
                                updated[idx].lecons[leconIdx] = lec
                                setModules(updated)
                              }}
                              style={{ ...btnDangerStyle, fontSize: '10px', padding: '1px 6px', marginTop: '3px' }}
                            >
                              Retirer l&apos;image
                            </button>
                          </div>
                        ) : (
                          <label htmlFor={leconImgId} style={{ ...btnSecStyle, fontSize: '11px', padding: '2px 8px', cursor: 'pointer', display: 'inline-block' }}>
                            + Image
                            <input
                              id={leconImgId}
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={e => {
                                const f = e.target.files?.[0]
                                if (f) handleLeconImageUpload(f, idx, leconIdx)
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Questionnaire */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '700', margin: 0, color: '#111827' }}>Questionnaire (optionnel)</h2>
          <button onClick={addQuestion} style={{ ...btnStyle, padding: '6px 12px', fontSize: '13px' }}>+ Question</button>
        </div>
        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle}>Seuil de réussite (%)</label>
          <input style={{ ...inputStyle, maxWidth: '120px' }} type="number" min={0} max={100} value={seuilReussite} onChange={e => setSeuilReussite(Number(e.target.value))} />
        </div>
        {questions.map((q, qi) => (
          <div key={qi} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '14px', marginBottom: '10px', background: '#f9fafb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#6b7280' }}>Question {qi + 1}</span>
              <button onClick={() => removeQuestion(qi)} style={btnDangerStyle}>Supprimer</button>
            </div>
            <input
              style={{ ...inputStyle, marginBottom: '8px' }}
              value={q.texte}
              onChange={e => setQuestions(prev => prev.map((q2, i) => i === qi ? { ...q2, texte: e.target.value } : q2))}
              placeholder="Texte de la question..."
            />
            {q.reponses.map((r, ri) => (
              <div key={ri} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                <input
                  type="radio"
                  checked={r.est_correcte}
                  onChange={() => setQuestions(prev => prev.map((q2, i) => i !== qi ? q2 : { ...q2, reponses: q2.reponses.map((r2, j) => ({ ...r2, est_correcte: j === ri })) }))}
                />
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={r.texte}
                  onChange={e => setQuestions(prev => prev.map((q2, i) => i !== qi ? q2 : { ...q2, reponses: q2.reponses.map((r2, j) => j === ri ? { ...r2, texte: e.target.value } : r2) }))}
                  placeholder={'Réponse ' + (ri + 1) + (r.est_correcte ? ' (correcte)' : '')}
                />
                {q.reponses.length > 2 && (
                  <button
                    onClick={() => setQuestions(prev => prev.map((q2, i) => i !== qi ? q2 : { ...q2, reponses: q2.reponses.filter((_, j) => j !== ri) }))}
                    style={btnDangerStyle}
                  >✕</button>
                )}
              </div>
            ))}
            <button
              onClick={() => setQuestions(prev => prev.map((q2, i) => i !== qi ? q2 : { ...q2, reponses: [...q2.reponses, { texte: '', est_correcte: false }] }))}
              style={{ ...btnSecStyle, fontSize: '12px', marginTop: '4px' }}
            >
              + Réponse
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <a href="/admin/formations" style={{ ...btnSecStyle, textDecoration: 'none', display: 'inline-block', padding: '8px 18px' }}>Annuler</a>
        <button onClick={handleSave} disabled={saving} style={{ ...btnStyle, opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Enregistrement...' : '✓ Créer la formation'}
        </button>
      </div>
    </div>
  )
}
