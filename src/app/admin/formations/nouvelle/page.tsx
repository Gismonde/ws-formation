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

interface BlocData {
  type: 'video' | 'file' | 'code' | 'link'
  contenu: string
}

interface LeconData {
  titre: string
  description: string
  image_url?: string
  blocs?: BlocData[]
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

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return match ? match[1] : null
}

export default function NouvelleFormationPage() {
  const router = useRouter()
  const [titre, setTitre] = useState('')
  const [categorie, setCategorie] = useState('Administration médicale')
  const [description, setDescription] = useState('')
  const [niveau, setNiveau] = useState('debutant')
  const [dureeHeures, setDureeHeures] = useState(1)
  const [dureeManuelle, setDureeManuelle] = useState(false)
  const [modules, setModules] = useState<ModuleForm[]>([{ titre: '', contenu: '', duree_minutes: 30, ordre: 1, lecons: [] }])
  const [questions, setQuestions] = useState<QuestionForm[]>([
    { texte: '', reponses: [{ texte: '', est_correcte: true }, { texte: '', est_correcte: false }, { texte: '', est_correcte: false }] }
  ])
  const [seuilReussite, setSeuilReussite] = useState(70)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [prerequisIds, setPrerequisIds] = useState<string[]>([])
  const [formationsDisponibles, setFormationsDisponibles] = useState<{id: string, titre: string}[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [publierImmediatement, setPublierImmediatement] = useState(false)

  // Durée auto-calculée depuis les modules
  useEffect(() => {
    if (!dureeManuelle && modules.length > 0) {
      const totalMinutes = modules.reduce((sum, m) => sum + (m.duree_minutes || 0), 0)
      const heures = Math.max(1, Math.round(totalMinutes / 60 * 10) / 10)
      setDureeHeures(heures)
    }
  }, [modules, dureeManuelle])

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
        if (saved.dureeManuelle) setDureeManuelle(saved.dureeManuelle)
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
        localStorage.setItem('nouvelle-formation-draft', JSON.stringify({ titre, description, categorie, niveau, dureeHeures, dureeManuelle, modules, questions, seuilReussite }))
      } catch {}
    }
  }, [titre, description, categorie, niveau, dureeHeures, dureeManuelle, modules, questions, seuilReussite])

  const addModule = () => {
    setModules(prev => [...prev, { titre: '', contenu: '', duree_minutes: 30, ordre: prev.length + 1, lecons: [] }])
  }

  const removeModule = (idx: number) => {
    setModules(prev => prev.filter((_, i) => i !== idx).map((m, i) => ({ ...m, ordre: i + 1 })))
  }

  const updateModule = (idx: number, field: keyof ModuleForm, value: string | number) => {
    setModules(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m))
  }

  const moveModule = (idx: number, dir: -1 | 1) => {
    setModules(prev => {
      const next = [...prev]
      const target = idx + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next.map((m, i) => ({ ...m, ordre: i + 1 }))
    })
  }

  const moveLecon = (moduleIdx: number, leconIdx: number, dir: -1 | 1) => {
    setModules(prev => {
      const next = prev.map(m => ({ ...m, lecons: [...m.lecons] }))
      const lecons = next[moduleIdx].lecons
      const target = leconIdx + dir
      if (target < 0 || target >= lecons.length) return prev
      ;[lecons[leconIdx], lecons[target]] = [lecons[target], lecons[leconIdx]]
      return next
    })
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

  async function handleSave() {
    // Validation renforcée
    const errors: string[] = []
    if (!titre.trim()) errors.push('Le titre est requis.')
    if (modules.length === 0) errors.push('Au moins un module est requis.')
    const emptyModules = modules.filter(m => !m.titre.trim())
    if (emptyModules.length > 0) errors.push('Chaque module doit avoir un titre.')
    const invalidDurations = modules.filter(m => !m.duree_minutes || m.duree_minutes <= 0)
    if (invalidDurations.length > 0) errors.push('Chaque module doit avoir une durée supérieure à 0.')
    const emptyLecons = modules.flatMap(m => m.lecons || []).filter(l => !l.titre.trim())
    if (emptyLecons.length > 0) errors.push('Chaque leçon doit avoir un titre.')
    const filledQuestions = questions.filter(q => q.texte.trim())
    if (filledQuestions.length > 0) {
      const noCorrect = filledQuestions.filter(q => !q.reponses.some(r => r.est_correcte))
      if (noCorrect.length > 0) errors.push('Chaque question doit avoir au moins une réponse correcte.')
      const emptyR = filledQuestions.filter(q => q.reponses.some(r => !r.texte.trim()))
      if (emptyR.length > 0) errors.push('Chaque réponse doit avoir un texte.')
    }
    if (errors.length > 0) { setError(errors.join(' | ')); return }

    setSaving(true)
    setError('')
    const supabase = createClient()

    try {
      const { data: formation, error: errF } = await supabase
        .from('formations')
        .insert({ titre, categorie, description, niveau, duree_heures: dureeHeures, est_publiee: publierImmediatement === true, tags: tags || [], objectifs: objectifs || [], image_couverture: imageCouverture || null, prerequis_ids: prerequisIds || [] })
        .select()
        .single()
      if (errF || !formation) throw new Error(errF?.message || 'Erreur création formation')

      const { data: modulesCreated, error: errM } = await supabase
        .from('modules')
        .insert(modules.map(m => ({ titre: m.titre, contenu: m.contenu, duree_minutes: m.duree_minutes, ordre: m.ordre, formation_id: formation.id })))
        .select()
      if (errM) throw new Error(errM.message)

      if (modulesCreated) {
        for (let mIdx = 0; mIdx < modules.length; mIdx++) {
          const mod = modules[mIdx]
          const createdMod = modulesCreated[mIdx]
          if (!createdMod || !mod.lecons || mod.lecons.length === 0) continue
          const { error: errL } = await supabase
            .from('lecons')
            .insert(mod.lecons.map((l, lIdx) => ({
              module_id: createdMod.id,
              titre: l.titre || ('Leçon ' + (lIdx + 1)),
              description: l.description || '',
              image_url: l.image_url || null,
              ordre: lIdx + 1,
              est_obligatoire: true,
            })))
          if (errL) console.error('Erreur insert leçons:', errL.message)

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
                await supabase.from('content_blocks').insert(blocsToInsert)
              }

              // Enriched blocs (video, file, code, link)
              for (let lIdx2 = 0; lIdx2 < (mod.lecons || []).length; lIdx2++) {
                const leconData = mod.lecons[lIdx2]
                if (!leconData.blocs || leconData.blocs.length === 0) continue
                const leconRow = insertedLecons?.[lIdx2]
                if (!leconRow) continue
                const extraBlocs = leconData.blocs.filter((b: any) => b.contenu?.trim()).map((b: any, bi: number) => ({ lesson_id: leconRow.id, type: b.type, contenu: b.contenu, ordre: bi + 2 }))
                if (extraBlocs.length > 0) await supabase.from('content_blocks').insert(extraBlocs)
              }
            }
          }
        }
      }

      const validQuestions = questions.filter(q => q.texte.trim())
      if (validQuestions.length > 0) {
        const { data: questionnaire, error: errQ } = await supabase
          .from('questionnaires')
          .insert({ formation_id: formation.id, titre: 'Questionnaire - ' + titre, seuil_reussite: seuilReussite })
          .select()
          .single()
        if (errQ || !questionnaire) throw new Error(errQ?.message || 'Erreur questionnaire')

        for (let i = 0; i < validQuestions.length; i++) {
          const q = validQuestions[i]
          const { data: question, error: errQu } = await supabase
            .from('questions')
            .insert({ questionnaire_id: questionnaire.id, texte: q.texte, type: 'qcm', ordre: i + 1 })
            .select()
            .single()
          if (errQu || !question) continue
          const validReponses = q.reponses.filter(r => r.texte.trim())
          if (validReponses.length > 0) {
            await supabase.from('reponses_possibles').insert(
              validReponses.map((r, ri) => ({
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
  const btnMoveStyle: React.CSSProperties = {
    background: '#f3f4f6',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '3px',
    padding: '1px 6px',
    fontSize: '12px',
    cursor: 'pointer',
    lineHeight: '1.2',
  }

  const totalMinutes = modules.reduce((s, m) => s + (m.duree_minutes || 0), 0)
  const autoHeures = Math.max(1, Math.round(totalMinutes / 60 * 10) / 10)

    if (showPreview) {
    const totalLecons = modules.reduce((sum, m) => sum + (m.lecons || []).length, 0)
    const validQs = questions.filter(q => q.texte.trim())
    return (
      <div style={{ maxWidth: '600px', margin: '40px auto', padding: '32px', background: '#fff', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.1)', fontFamily: 'system-ui, sans-serif' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', margin: '0 0 4px' }}>Aperçu avant création</h2>
        <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 24px' }}>Vérifiez les informations avant de créer la formation.</p>
        <div style={{ display: 'grid', gap: '14px', marginBottom: '24px' }}>
          <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><span style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase' }}>Titre</span><p style={{ fontSize: '15px', fontWeight: '600', color: '#111827', margin: '4px 0 0' }}>{titre}</p></div>
              <div><span style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase' }}>Niveau</span><p style={{ fontSize: '14px', color: '#374151', margin: '4px 0 0', textTransform: 'capitalize' }}>{niveau}</p></div>
              <div><span style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase' }}>Modules</span><p style={{ fontSize: '14px', color: '#374151', margin: '4px 0 0' }}>{modules.length} module{modules.length > 1 ? 's' : ''} — {totalLecons} leçon{totalLecons > 1 ? 's' : ''}</p></div>
              <div><span style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase' }}>Durée</span><p style={{ fontSize: '14px', color: '#374151', margin: '4px 0 0' }}>{dureeHeures}h</p></div>
            </div>
          </div>
          {(tags.length > 0 || objectifs.length > 0) && (
            <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
              {tags.length > 0 && <div style={{ marginBottom: '8px' }}><span style={{ fontSize: '12px', fontWeight: '600' }}>Tags</span><div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>{tags.map((t, i) => <span key={i} style={{ background: '#ede9fe', color: '#5b21b6', fontSize: '11px', padding: '1px 8px', borderRadius: '20px' }}>{t}</span>)}</div></div>}
              {objectifs.length > 0 && <div><span style={{ fontSize: '12px', fontWeight: '600' }}>Objectifs ({objectifs.length})</span>{objectifs.map((o, i) => <p key={i} style={{ fontSize: '12px', color: '#374151', margin: '4px 0 0' }}>✓ {o}</p>)}</div>}
            </div>
          )}
          {prerequisIds.length > 0 && (
            <div style={{ padding: '12px 16px', background: '#fefce8', borderRadius: '10px', border: '1px solid #fef08a' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#713f12' }}>⚠️ {prerequisIds.length} prérequis obligatoire{prerequisIds.length > 1 ? 's' : ''}</span>
            </div>
          )}
          {validQs.length > 0 && (
            <div style={{ padding: '12px 16px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#15803d' }}>✓ Questionnaire : {validQs.length} question{validQs.length > 1 ? 's' : ''}, seuil {seuilReussite}%</span>
            </div>
          )}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#374151', marginBottom: '16px', cursor: 'pointer' }}>
          <input type="checkbox" checked={publierImmediatement} onChange={e => setPublierImmediatement(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
          <span>Publier immédiatement (visible par les apprenants)</span>
        </label>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button onClick={() => setShowPreview(false)} style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', padding: '10px 20px', fontSize: '14px', cursor: 'pointer', fontWeight: '500' }}>← Modifier</button>
          <button onClick={handleSave} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 2px 8px rgba(37,99,235,0.35)' }}>✓ Confirmer et créer</button>
        </div>
      </div>
    )
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
            <input
              style={{ ...inputStyle, borderColor: !titre.trim() && saving ? '#ef4444' : '#d1d5db' }}
              value={titre}
              onChange={e => setTitre(e.target.value)}
              placeholder="Titre de la formation"
            />
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
              <label style={labelStyle}>
                Durée (heures)
                {!dureeManuelle && (
                  <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: '400', marginLeft: '6px' }}>
                    (auto: {autoHeures}h)
                  </span>
                )}
              </label>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  type="number"
                  min={0.5}
                  max={40}
                  step={0.5}
                  value={dureeHeures}
                  onChange={e => { setDureeManuelle(true); setDureeHeures(Number(e.target.value)) }}
                />
                {dureeManuelle && (
                  <button
                    onClick={() => { setDureeManuelle(false); setDureeHeures(autoHeures) }}
                    style={{ ...btnSecStyle, padding: '6px 8px', fontSize: '12px', whiteSpace: 'nowrap' }}
                    title="Recalculer automatiquement"
                  >
                    🔄
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modules */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '700', margin: 0, color: '#111827' }}>Modules ({modules.length}) — {totalMinutes} min total</h2>
          <button onClick={addModule} style={{ ...btnStyle, padding: '6px 12px', fontSize: '13px' }}>+ Module</button>
        </div>

        {modules.map((mod, idx) => (
          <div key={idx} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '14px', marginBottom: '10px', background: '#f9fafb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <button onClick={() => moveModule(idx, -1)} style={btnMoveStyle} disabled={idx === 0} title="Monter">▲</button>
                  <button onClick={() => moveModule(idx, 1)} style={btnMoveStyle} disabled={idx === modules.length - 1} title="Descendre">▼</button>
                </div>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#6b7280' }}>Module {idx + 1}</span>
              </div>
              <button onClick={() => removeModule(idx)} style={btnDangerStyle}>Supprimer</button>
            </div>
            <div style={{ display: 'grid', gap: '8px' }}>
              <div>
                <label style={{ ...labelStyle, fontSize: '12px' }}>Titre *</label>
                <input
                  style={{ ...inputStyle, borderColor: !mod.titre.trim() ? '#ef4444' : '#d1d5db' }}
                  value={mod.titre}
                  onChange={e => updateModule(idx, 'titre', e.target.value)}
                  placeholder="Titre du module"
                />
                {!mod.titre.trim() && <p style={{ color: '#dc2626', fontSize: '11px', margin: '2px 0 0' }}>Titre requis</p>}
              </div>
              <div>
                <label style={{ ...labelStyle, fontSize: '12px' }}>Contenu</label>
                <textarea
                  style={{ ...inputStyle, minHeight: '80px', resize: 'vertical', fontSize: '13px' }}
                  value={mod.contenu}
                  onChange={e => updateModule(idx, 'contenu', e.target.value)}
                  placeholder="Contenu du module..."
                />
              </div>
              <div style={{ maxWidth: '160px' }}>
                <label style={{ ...labelStyle, fontSize: '12px' }}>Durée (min) *</label>
                <input
                  style={{ ...inputStyle, borderColor: (!mod.duree_minutes || mod.duree_minutes <= 0) ? '#ef4444' : '#d1d5db' }}
                  type="number"
                  min={5}
                  max={480}
                  value={mod.duree_minutes}
                  onChange={e => updateModule(idx, 'duree_minutes', Number(e.target.value))}
                />
                {(!mod.duree_minutes || mod.duree_minutes <= 0) && <p style={{ color: '#dc2626', fontSize: '11px', margin: '2px 0 0' }}>&gt; 0 requis</p>}
              </div>

              {/* Leçons */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ ...labelStyle, fontSize: '12px', marginBottom: 0 }}>Leçons ({(mod.lecons || []).length})</label>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <button onClick={() => moveLecon(idx, leconIdx, -1)} style={{ ...btnMoveStyle, fontSize: '10px', padding: '0px 4px' }} disabled={leconIdx === 0} title="Monter">▲</button>
                            <button onClick={() => moveLecon(idx, leconIdx, 1)} style={{ ...btnMoveStyle, fontSize: '10px', padding: '0px 4px' }} disabled={leconIdx === (mod.lecons || []).length - 1} title="Descendre">▼</button>
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280' }}>Leçon {leconIdx + 1}</span>
                        </div>
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
                        style={{ ...inputStyle, marginBottom: '4px', fontSize: '12px', borderColor: !lecon.titre.trim() ? '#ef4444' : '#d1d5db' }}
                        value={lecon.titre}
                        onChange={e => {
                          const updated = [...modules]
                          updated[idx].lecons[leconIdx] = { ...updated[idx].lecons[leconIdx], titre: e.target.value }
                          setModules(updated)
                        }}
                        placeholder="Titre de la leçon *"
                      />
                      {!lecon.titre.trim() && <p style={{ color: '#dc2626', fontSize: '11px', margin: '-2px 0 4px' }}>Titre requis</p>}
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
                      {/* Enriched blocs */}
                      {(lecon.blocs || []).length > 0 && (lecon.blocs || []).map((bloc: any, bi: number) => (
                        <div key={bi} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '5px', padding: '6px 8px', marginTop: '4px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px' }}>{bloc.type === 'video' ? '🎬' : bloc.type === 'file' ? '📎' : bloc.type === 'code' ? '💻' : '🔗'}</span>
                          <input style={{ ...inputStyle, flex: 1, fontSize: '11px' }} value={bloc.contenu} onChange={e => { const up = [...modules]; const b = [...(up[idx].lecons[leconIdx].blocs || [])]; b[bi] = { ...b[bi], contenu: e.target.value }; up[idx].lecons[leconIdx] = { ...up[idx].lecons[leconIdx], blocs: b }; setModules(up) }} placeholder={bloc.type === 'video' ? 'URL YouTube/Vimeo' : bloc.type === 'file' ? 'URL PDF' : bloc.type === 'link' ? 'URL lien' : 'Code'} />
                          {bloc.type === 'video' && extractYouTubeId(bloc.contenu) && (
                            <div style={{ marginTop: '8px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                              <img
                                src={'https://img.youtube.com/vi/' + extractYouTubeId(bloc.contenu) + '/mqdefault.jpg'}
                                alt="YouTube preview"
                                style={{ width: '100%', display: 'block', maxHeight: '120px', objectFit: 'cover' }}
                              />
                              <div style={{ padding: '4px 8px', background: '#f9fafb', fontSize: '12px', color: '#6b7280' }}>YouTube</div>
                            </div>
                          )}
                          <button onClick={() => { const up = [...modules]; const b = (up[idx].lecons[leconIdx].blocs || []).filter((_: any, i: number) => i !== bi); up[idx].lecons[leconIdx] = { ...up[idx].lecons[leconIdx], blocs: b }; setModules(up) }} style={{ ...btnDangerStyle, fontSize: '10px', padding: '1px 5px' }}>×</button>
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: '3px', marginTop: '4px', flexWrap: 'wrap' }}>
                        {(['video', 'file', 'code', 'link'] as const).map(type => (
                          <button key={type} onClick={() => { const up = [...modules]; const blocs = [...(up[idx].lecons[leconIdx].blocs || []), { type, contenu: '' }]; up[idx].lecons[leconIdx] = { ...up[idx].lecons[leconIdx], blocs }; setModules(up) }} style={{ background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '3px', padding: '2px 6px', fontSize: '10px', cursor: 'pointer' }}>
                            + {type === 'video' ? '🎬' : type === 'file' ? '📎' : type === 'code' ? '💻' : '🔗'}
                          </button>
                        ))}
                      </div>
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

      {/* Enrichissement */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '24px', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px', color: '#111827' }}>Enrichissement</h2>
        <div style={{ display: 'grid', gap: '16px' }}>
          {/* Image couverture */}
          <div>
            <label style={labelStyle}>Image de couverture</label>
            {imageCouverture ? (
              <div>
                <img src={imageCouverture} alt="Couverture" style={{ maxWidth: '220px', maxHeight: '130px', borderRadius: '6px', border: '1px solid #e5e7eb', display: 'block', marginBottom: '6px' }} />
                <button onClick={() => setImageCouverture(null)} style={{ ...btnDangerStyle, fontSize: '11px' }}>Retirer</button>
              </div>
            ) : (
              <label htmlFor="cover-img-nv" style={{ ...btnSecStyle, display: 'inline-block', cursor: 'pointer', fontSize: '12px' }}>
                + Image de couverture
                <input id="cover-img-nv" type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
                  const f = e.target.files?.[0]; if (!f) return
                  const fd = new FormData(); fd.append('file', f)
                  const res = await fetch('/api/upload-lesson-image', { method: 'POST', body: fd })
                  const d = await res.json(); if (d.url) setImageCouverture(d.url)
                }} />
              </label>
            )}
          </div>
          {/* Tags */}
          <div>
            <label style={labelStyle}>Tags / mots-clés</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '6px' }}>
              {tags.map((tag, ti) => (
                <span key={ti} style={{ background: '#ede9fe', color: '#5b21b6', fontSize: '12px', padding: '2px 8px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  {tag}<button onClick={() => setTags(prev => prev.filter((_, i) => i !== ti))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7c3aed', fontSize: '13px', padding: 0 }}>×</button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input style={{ ...inputStyle, flex: 1 }} value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) { e.preventDefault(); setTags(p => [...p, tagInput.trim()]); setTagInput('') } }} placeholder="Tag (Entrée ou virgule)" />
              <button onClick={() => { if (tagInput.trim()) { setTags(p => [...p, tagInput.trim()]); setTagInput('') } }} style={{ ...btnSecStyle, padding: '6px 12px' }}>+</button>
            </div>
          </div>
          {/* Objectifs */}
          <div>
            <label style={labelStyle}>Objectifs pédagogiques</label>
            <p style={{ fontSize: '11px', color: '#9ca3af', margin: '0 0 6px' }}>À la fin de cette formation, l&apos;apprenant saura...</p>
            {objectifs.map((obj, oi) => (
              <div key={oi} style={{ display: 'flex', gap: '6px', marginBottom: '4px', alignItems: 'center' }}>
                <span style={{ color: '#10b981', fontSize: '12px' }}>✓</span>
                <span style={{ flex: 1, fontSize: '13px', color: '#374151' }}>{obj}</span>
                <button onClick={() => setObjectifs(prev => prev.filter((_, i) => i !== oi))} style={{ ...btnDangerStyle, fontSize: '10px', padding: '1px 6px' }}>×</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: '6px' }}>
              <input style={{ ...inputStyle, flex: 1 }} value={objectifInput} onChange={e => setObjectifInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && objectifInput.trim()) { e.preventDefault(); setObjectifs(p => [...p, objectifInput.trim()]); setObjectifInput('') } }} placeholder="Ex: utiliser le logiciel X..." />
              <button onClick={() => { if (objectifInput.trim()) { setObjectifs(p => [...p, objectifInput.trim()]); setObjectifInput('') } }} style={{ ...btnSecStyle, padding: '6px 12px' }}>+</button>
            </div>
          </div>
        </div>
      
          {/* Prérequis */}
          <div>
            <label style={labelStyle}>Prérequis (formations obligatoires avant)</label>
            <p style={{ fontSize: '11px', color: '#9ca3af', margin: '0 0 6px' }}>Sélectionnez les formations que l&apos;apprenant doit avoir terminées avant d&apos;accéder à celle-ci.</p>
            {formationsDisponibles.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>Aucune formation publiée disponible.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px' }}>
                {formationsDisponibles.map(f => (
                  <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={prerequisIds.includes(f.id)}
                      onChange={e => {
                        if (e.target.checked) setPrerequisIds(prev => [...prev, f.id])
                        else setPrerequisIds(prev => prev.filter(id => id !== f.id))
                      }}
                    />
                    <span style={{ color: '#374151' }}>{f.titre}</span>
                  </label>
                ))}
              </div>
            )}
            {prerequisIds.length > 0 && (
              <p style={{ fontSize: '11px', color: '#7c3aed', margin: '4px 0 0' }}>✓ {prerequisIds.length} prérequis sélectionné{prerequisIds.length > 1 ? 's' : ''}</p>
            )}
          </div>
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
              style={{ ...inputStyle, marginBottom: '8px', borderColor: q.texte.trim() && !q.reponses.some(r => r.est_correcte) ? '#ef4444' : '#d1d5db' }}
              value={q.texte}
              onChange={e => setQuestions(prev => prev.map((q2, i) => i === qi ? { ...q2, texte: e.target.value } : q2))}
              placeholder="Texte de la question..."
            />
            {q.texte.trim() && !q.reponses.some(r => r.est_correcte) && (
              <p style={{ color: '#dc2626', fontSize: '11px', margin: '-4px 0 8px' }}>Aucune réponse correcte sélectionnée</p>
            )}
            {q.reponses.map((r, ri) => (
              <div key={ri} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                <input
                  type="radio"
                  checked={r.est_correcte}
                  onChange={() => setQuestions(prev => prev.map((q2, i) => i !== qi ? q2 : { ...q2, reponses: q2.reponses.map((r2, j) => ({ ...r2, est_correcte: j === ri })) }))}
                />
                <input
                  style={{ ...inputStyle, flex: 1, borderColor: q.texte.trim() && !r.texte.trim() ? '#ef4444' : '#d1d5db' }}
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
        <button onClick={() => setShowPreview(true)} disabled={saving} style={{ ...btnStyle, opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Enregistrement...' : '✓ Créer la formation'}
        </button>
      </div>
    </div>
  )
}
