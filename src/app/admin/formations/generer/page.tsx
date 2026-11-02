'use client'

import ChampDuree, { formatDuree } from '@/components/ChampDuree'
import { useT } from '@/lib/i18n/client'
import { useState, useCallback, useEffect } from 'react'
import { ChampCategorie } from '@/components/ChampCategorie'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChampCliniqueFormation } from '@/components/ChampCliniqueFormation'
import type { CliniqueContenu } from '@/lib/cliniques'


import { inferMetadata, parseDocumentIntoModules, type ModuleData } from '@/lib/import-document'


type Step = 'upload' | 'review' | 'quiz' | 'creating' | 'done'

export default function GenererFormationPage() {
  const { t } = useT()
  const router = useRouter()
  const [step, setStep] = useState<Step>('upload')
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [titre, setTitre] = useState('')
  const [responsable, setResponsable] = useState('')
  const [description, setDescription] = useState('')
  const [clinique, setClinique] = useState<CliniqueContenu | null>(null)
  const [categorie, setCategorie] = useState('Administration médicale')
  const [niveau, setNiveau] = useState('debutant')
  const [dureeHeures, setDureeHeures] = useState(1)
  const [dureeManuelle, setDureeManuelle] = useState(false)
  const [modules, setModules] = useState<ModuleData[]>([])
  const [error, setError] = useState('')
  const [formationId, setFormationId] = useState('')
  const [questions, setQuestions] = useState<{ texte: string; reponses: { texte: string; est_correcte: boolean }[] }[]>([])
  const [seuilReussite, setSeuilReussite] = useState(70)
  // Enrichissement
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [objectifs, setObjectifs] = useState<string[]>([])
  const [objectifInput, setObjectifInput] = useState('')
  const [imageCouverture, setImageCouverture] = useState<string | null>(null)
  const [prerequisIds, setPrerequisIds] = useState<string[]>([])
  const [formationsDisponibles, setFormationsDisponibles] = useState<{id: string, titre: string}[]>([])
  const [showPreview, setShowPreview] = useState(false)

  // Durée auto-calculée depuis les modules
  useEffect(() => {
    if (!dureeManuelle && modules.length > 0) {
      const totalMinutes = modules.reduce((sum, m) => sum + (m.duree_minutes || 0), 0)
      const heures = Math.max(5, totalMinutes) / 60
      setDureeHeures(heures)
    }
  }, [modules, dureeManuelle])
  // Load existing formations for prerequis selector
  useEffect(() => {
    const supabase = createClient()
    supabase.from('formations').select('id, titre').eq('publiee', true).order('titre').then(({ data }) => {
      if (data) setFormationsDisponibles(data)
    })
  }, [])

  // Restore draft from localStorage
  useEffect(() => {
    try {
      const draft = localStorage.getItem('generer-formation-draft')
      if (draft) {
        const saved = JSON.parse(draft)
        if (saved.titre) setTitre(saved.titre)
        if (saved.description) setDescription(saved.description)
        if (saved.categorie) setCategorie(saved.categorie)
        if (saved.niveau) setNiveau(saved.niveau)
        if (saved.dureeHeures) setDureeHeures(saved.dureeHeures)
        if (saved.dureeManuelle) setDureeManuelle(saved.dureeManuelle)
        if (saved.modules && saved.modules.length > 0) { setModules(saved.modules); setStep('review') }
        if (saved.questions) setQuestions(saved.questions)
        if (saved.seuilReussite) setSeuilReussite(saved.seuilReussite)
      }
    } catch {}
  }, [])

  // Auto-save draft
  useEffect(() => {
    if (modules.length > 0 || titre) {
      try {
        localStorage.setItem('generer-formation-draft', JSON.stringify({ titre, description, categorie, niveau, dureeHeures, dureeManuelle, modules, questions, seuilReussite }))
      } catch {}
    }
  }, [titre, description, categorie, niveau, dureeHeures, dureeManuelle, modules, questions, seuilReussite, tags, objectifs, prerequisIds, imageCouverture])

  // Reorder modules
  const moveModule = (idx: number, dir: -1 | 1) => {
    setModules(prev => {
      const next = [...prev]
      const target = idx + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }

  // Reorder leçons within a module
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

  const processFile = useCallback(async (file: File) => {
    if (!file) return
    setFileName(file.name)
    setError('')

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

    if (isPdf) {
      try {
        const arrayBuffer = await file.arrayBuffer()
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@' + pdfjsLib.version + '/build/pdf.worker.min.mjs'

        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) })
        const pdf = await loadingTask.promise
        let fullText = ''
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const content = await page.getTextContent()
          const pageText = content.items
            .map(item => ('str' in item ? item.str : ''))
            .join(' ')
          fullText += '\n=== Diapositive ' + i + ' / ' + pdf.numPages + ' ===\n' + pageText + '\n'
        }

        const parsed = parseDocumentIntoModules(fullText)
        setTitre(parsed.titre)
        setDescription(parsed.description)
        const inferredPdf = inferMetadata(fullText, parsed.titre, parsed.modules)
        if (!categorie) setCategorie(inferredPdf.categorie)
        setNiveau(inferredPdf.niveau)
        if (inferredPdf.tags.length > 0) setTags(inferredPdf.tags)
        if (inferredPdf.objectifs.length > 0) setObjectifs(inferredPdf.objectifs)
        setModules(parsed.modules.length > 0 ? parsed.modules : [{ titre: 'Module 1', contenu: '', duree_minutes: 30, lecons: [] }])
        setStep('review')
      } catch (err) {
        console.error('PDF error:', err)
        setError(t('Erreur lors de la lecture du PDF. Vérifiez que le fichier n\'est pas protégé.'))
      }
    } else {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = (e.target?.result as string) || ''
        const parsed = parseDocumentIntoModules(text)
        setTitre(parsed.titre)
        setDescription(parsed.description)
        const inferredTxt = inferMetadata(text, parsed.titre, parsed.modules)
        if (!categorie) setCategorie(inferredTxt.categorie)
        setNiveau(inferredTxt.niveau)
        if (inferredTxt.tags.length > 0) setTags(inferredTxt.tags)
        if (inferredTxt.objectifs.length > 0) setObjectifs(inferredTxt.objectifs)
        setModules(parsed.modules.length > 0 ? parsed.modules : [{ titre: 'Module 1', contenu: '', duree_minutes: 30, lecons: [] }])
        setStep('review')
      }
      reader.onerror = () => setError(t('Erreur lors de la lecture du fichier.'))
      reader.readAsText(file, 'UTF-8')
    }
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const addModule = () => {
    setModules(prev => [...prev, { titre: 'Module ' + (prev.length + 1), contenu: '', duree_minutes: 30, lecons: [] }])
  }

  const removeModule = (idx: number) => {
    setModules(prev => prev.filter((_, i) => i !== idx))
  }

  const updateModule = (idx: number, field: keyof ModuleData, value: string | number) => {
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

  const handleSubmit = async () => {
    // Validation renforcée
    const errors: string[] = []
    if (!titre.trim()) errors.push(t('Le titre de la formation est requis.'))
    if (!clinique) errors.push(t('Choisissez la clinique de la formation.'))
    if (modules.length === 0) errors.push(t('Au moins un module est requis.'))
    const emptyModules = modules.filter(m => !m.titre.trim())
    if (emptyModules.length > 0) errors.push(t('Chaque module doit avoir un titre.'))
    const invalidDurations = modules.filter(m => !m.duree_minutes || m.duree_minutes <= 0)
    if (invalidDurations.length > 0) errors.push(t('Chaque module doit avoir une durée supérieure à 0.'))
    const emptyLecons = modules.flatMap(m => m.lecons || []).filter(l => !l.titre.trim())
    if (emptyLecons.length > 0) errors.push(t('Chaque leçon doit avoir un titre.'))
    if (questions.length > 0) {
      const emptyQ = questions.filter(q => !q.texte.trim())
      if (emptyQ.length > 0) errors.push(t('Chaque question du questionnaire doit avoir un texte.'))
      const noCorrect = questions.filter(q => !q.reponses.some(r => r.est_correcte))
      if (noCorrect.length > 0) errors.push(t('Chaque question doit avoir au moins une réponse correcte.'))
      const emptyR = questions.filter(q => q.reponses.some(r => !r.texte.trim()))
      if (emptyR.length > 0) errors.push(t('Chaque réponse doit avoir un texte.'))
    }
    if (errors.length > 0) { setError(errors.join(' | ')); setShowPreview(false); window.scrollTo({ top: 0, behavior: 'smooth' }); return }

    setStep('creating')
    setError('')

    try {
      const res = await fetch('/api/generer-formation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titre, responsable_formation: responsable, description, categorie, niveau, clinique, duree_heures: dureeHeures, modules, questionnaire: questions.length > 0 ? { seuil_reussite: seuilReussite, questions } : null, tags, objectifs, prerequis_ids: prerequisIds, image_couverture: imageCouverture }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || t('Erreur lors de la création.'))
        setStep('review')
        return
      }
      setFormationId(data.formation_id)
      localStorage.removeItem('generer-formation-draft')
      setStep('done')
    } catch {
      setError(t('Erreur réseau.'))
      setStep('review')
    }
  }

  const containerStyle: React.CSSProperties = {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '32px 24px',
  }

  const cardStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '32px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '6px',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    boxSizing: 'border-box',
    background: '#fff',
    outline: 'none',
  }

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
  }

  const btnPrimaryStyle: React.CSSProperties = {
    background: '#4f46e5',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 24px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  }

  const btnSecondaryStyle: React.CSSProperties = {
    background: '#f3f4f6',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    padding: '10px 24px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  }

  const btnDangerStyle: React.CSSProperties = {
    background: '#fee2e2',
    color: '#991b1b',
    border: 'none',
    borderRadius: '6px',
    padding: '4px 10px',
    fontSize: '12px',
    cursor: 'pointer',
  }

  const btnMoveStyle: React.CSSProperties = {
    background: '#f3f4f6',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    padding: '2px 7px',
    fontSize: '13px',
    cursor: 'pointer',
    lineHeight: '1.2',
  }

  // STEP: Upload
  if (step === 'upload') {
    return (
      <div style={containerStyle}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: '8px 0 4px' }}>
            {t('Générer une formation depuis un document')}
          </h1>
          <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
            Importez un fichier texte (.txt, .md) ou PDF contenant une procédure ou une politique.
            Le système extraira automatiquement la structure en modules.
          </p>
        </div>

        <div style={cardStyle}>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            style={{
              border: '2px dashed ' + (dragging ? '#4f46e5' : '#d1d5db'),
              borderRadius: '12px',
              padding: '48px 32px',
              textAlign: 'center',
              background: dragging ? '#eef2ff' : '#f9fafb',
              transition: 'all 0.2s',
              cursor: 'pointer',
            }}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
            <p style={{ fontSize: '16px', fontWeight: '600', color: '#374151', margin: '0 0 8px' }}>
              {t('Glissez votre document ici')}
            </p>
            <p style={{ fontSize: '14px', color: '#9ca3af', margin: '0 0 20px' }}>
              {t('ou cliquez pour sélectionner un fichier')}
            </p>
            <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>
              Formats supportés: .txt, .md, .pdf (procédures, politiques, SOPs)
            </p>
          </div>
          <input
            id="file-input"
            type="file"
            accept=".txt,.md,.text,.pdf,application/pdf"
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />

          {error && (
            <p style={{ color: '#dc2626', fontSize: '14px', marginTop: '16px', background: '#fee2e2', padding: '10px', borderRadius: '6px' }}>
              {error}
            </p>
          )}

          <div style={{ marginTop: '24px', padding: '16px', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
            <p style={{ fontSize: '13px', color: '#0369a1', margin: 0, lineHeight: '1.6' }}>
              <strong>{t('Conseil :')}</strong> Pour de meilleurs résultats, utilisez un document avec des titres de sections clairs
              (ex: &quot;1. Introduction&quot;, &quot;## Procédure&quot;, &quot;SECTION: Sécurité&quot;).
              Chaque section deviendra un module de formation.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // STEP: Review
  if (step === 'review') {
    const totalMinutes = modules.reduce((s, m) => s + (m.duree_minutes || 0), 0)
    const autoHeures = Math.max(5, totalMinutes) / 60

    return (
      <div style={containerStyle}>
        <div style={{ marginBottom: '24px' }}>
          <button onClick={() => setStep('upload')} style={{ ...btnSecondaryStyle, padding: '6px 14px', fontSize: '13px' }}>
            {t('← Changer de fichier')}
          </button>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: '12px 0 4px' }}>
            {t('Vérifier et ajuster la formation')}
          </h1>
          <p style={{ color: '#6b7280', fontSize: '13px', margin: 0 }}>
            {t('Fichier:')} <strong>{fileName}</strong> — {modules.length} module(s) détecté(s)
          </p>
        </div>

        {error && (
          <p style={{ color: '#dc2626', fontSize: '14px', marginBottom: '16px', background: '#fee2e2', padding: '10px', borderRadius: '6px' }}>
            {error}
          </p>
        )}

        <div style={{ ...cardStyle, marginBottom: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#111827', margin: '0 0 20px' }}>
            {t('Informations générales')}
          </h2>
          <div style={{ display: 'grid', gap: '16px' }}>
<div>
            <label style={labelStyle}>{t('Responsable de la formation')}</label>
            <input style={inputStyle} value={responsable} onChange={e => setResponsable(e.target.value)} maxLength={120} placeholder={t('Ex. : Dre Julie Martin, directrice des soins infirmiers')} />
            <span style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px', display: 'block' }}>{t('Ce nom apparaît sur le certificat remis aux employés.')}</span>
          </div>
            <div>
              <label style={labelStyle}>{t('Titre de la formation *')}</label>
              <input style={inputStyle} value={titre} onChange={e => setTitre(e.target.value)} placeholder={t('Titre de la formation')} />
            </div>
            <div>
              <label style={labelStyle}>{t('Description')}</label>
              <textarea
                style={{ ...inputStyle, minHeight: '120px', resize: 'vertical' }}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={t('Description de la formation... (Astuce : utilisez des retours à la ligne pour structurer)')}
              />
              <span style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px', display: 'block' }}>{t('Mise en forme: **gras**, *italique*, - liste, laisser une ligne vide entre paragraphes')}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
              <ChampCliniqueFormation valeur={clinique} onChange={setClinique} style={selectStyle} labelStyle={labelStyle} />
              <div>
                <label style={labelStyle}>{t('Catégorie')}</label>
                <ChampCategorie valeur={categorie} onChange={setCategorie} style={selectStyle} />
              </div>
              <div>
                <label style={labelStyle}>{t('Niveau')}</label>
                <select style={selectStyle} value={niveau} onChange={e => setNiveau(e.target.value)}>
                  <option value="debutant">{t('Débutant')}</option>
                  <option value="intermediaire">{t('Intermédiaire')}</option>
                  <option value="avance">{t('Avancé')}</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>
                  {t('Durée')}
                  {!dureeManuelle && (
                    <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: '400', marginLeft: '6px' }}>
                      (auto : {formatDuree(Math.round(autoHeures * 60))})
                    </span>
                  )}
                </label>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <ChampDuree className="flex-1" minutes={Math.round(dureeHeures * 60)} onChange={m => { setDureeManuelle(true); setDureeHeures(m / 60) }} />
                  {dureeManuelle && (
                    <button
                      onClick={() => { setDureeManuelle(false); setDureeHeures(autoHeures) }}
                      style={{ ...btnSecondaryStyle, padding: '8px 10px', fontSize: '12px', whiteSpace: 'nowrap' }}
                      title={t('Recalculer automatiquement')}
                    >
                      {t('🔄 Auto')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Image de couverture + Tags + Objectifs */}
        <div style={{ ...cardStyle, marginBottom: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#111827', margin: '0 0 20px' }}>
            {t('Enrichissement')}
          </h2>
          <div style={{ display: 'grid', gap: '20px' }}>

            {/* Image de couverture */}
            <div>
              <label style={labelStyle}>{t('Image de couverture')}</label>
              {imageCouverture ? (
                <div>
                  <img src={imageCouverture} alt={t('Couverture')} style={{ maxWidth: '240px', maxHeight: '140px', borderRadius: '8px', border: '1px solid #e5e7eb', display: 'block', marginBottom: '8px' }} />
                  <button onClick={() => setImageCouverture(null)} style={btnDangerStyle}>{t('Retirer')}</button>
                </div>
              ) : (
                <label htmlFor="cover-img" style={{ ...btnSecondaryStyle, display: 'inline-block', cursor: 'pointer', fontSize: '13px' }}>
                  {t('+ Ajouter une image de couverture')}
                  <input id="cover-img" type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    const fd = new FormData(); fd.append('file', f)
                    const res = await fetch('/api/upload-lesson-image', { method: 'POST', body: fd })
                    const d = await res.json()
                    if (d.url) setImageCouverture(d.url)
                  }} />
                </label>
              )}
            </div>

            {/* Tags */}
            <div>
              <label style={labelStyle}>{t('Tags / mots-clés')}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                {tags.map((tag, ti) => (
                  <span key={ti} style={{ background: '#ede9fe', color: '#5b21b6', fontSize: '12px', padding: '3px 10px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {tag}
                    <button onClick={() => setTags(prev => prev.filter((_, i) => i !== ti))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7c3aed', fontSize: '14px', padding: 0, lineHeight: 1 }}>{t('×')}</button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) { e.preventDefault(); setTags(prev => [...prev, tagInput.trim()]); setTagInput('') } }}
                  placeholder={t('Ajouter un tag (Entrée ou virgule)')}
                />
                <button onClick={() => { if (tagInput.trim()) { setTags(prev => [...prev, tagInput.trim()]); setTagInput('') } }} style={{ ...btnSecondaryStyle, padding: '10px 14px' }}>+</button>
              </div>
            </div>

            {/* Objectifs pédagogiques */}
            <div>
              <label style={labelStyle}>{t('Objectifs pédagogiques')}</label>
              <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 8px' }}>À la fin de cette formation, l&apos;apprenant saura...</p>
              {objectifs.map((obj, oi) => (
                <div key={oi} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'flex-start' }}>
                  <span style={{ color: '#10b981', marginTop: '2px' }}>✓</span>
                  <span style={{ flex: 1, fontSize: '14px', color: '#374151' }}>{obj}</span>
                  <button onClick={() => setObjectifs(prev => prev.filter((_, i) => i !== oi))} style={{ ...btnDangerStyle, fontSize: '11px', padding: '2px 6px' }}>{t('×')}</button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={objectifInput}
                  onChange={e => setObjectifInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && objectifInput.trim()) { e.preventDefault(); setObjectifs(prev => [...prev, objectifInput.trim()]); setObjectifInput('') } }}
                  placeholder={t('Ex: utiliser le logiciel X de manière autonome')}
                />
                <button onClick={() => { if (objectifInput.trim()) { setObjectifs(prev => [...prev, objectifInput.trim()]); setObjectifInput('') } }} style={{ ...btnSecondaryStyle, padding: '10px 14px' }}>+</button>
              </div>
            </div>

          </div>
        </div>

        <div style={{ ...cardStyle, marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#111827', margin: 0 }}>
              Modules ({modules.length}) — Durée totale: {totalMinutes} min
            </h2>
            <button onClick={addModule} style={{ ...btnPrimaryStyle, padding: '6px 14px', fontSize: '13px' }}>
              {t('+ Ajouter un module')}
            </button>
          </div>

          {modules.map((mod, idx) => (
            <div
              key={idx}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '12px',
                background: '#f9fafb',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <button onClick={() => moveModule(idx, -1)} style={btnMoveStyle} disabled={idx === 0} title={t('Monter')}>▲</button>
                    <button onClick={() => moveModule(idx, 1)} style={btnMoveStyle} disabled={idx === modules.length - 1} title={t('Descendre')}>▼</button>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#6b7280' }}>{t('Module')}{' '}{idx + 1}</span>
                </div>
                <button onClick={() => removeModule(idx)} style={btnDangerStyle}>
                  {t('Supprimer')}
                </button>
              </div>
              <div style={{ display: 'grid', gap: '10px' }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: '13px' }}>{t('Titre *')}</label>
                  <input
                    style={{ ...inputStyle, borderColor: !mod.titre.trim() ? '#ef4444' : '#d1d5db' }}
                    value={mod.titre}
                    onChange={e => updateModule(idx, 'titre', e.target.value)}
                    placeholder={t('Titre du module')}
                  />
                  {!mod.titre.trim() && <p style={{ color: '#dc2626', fontSize: '12px', margin: '2px 0 0' }}>{t('Le titre est requis')}</p>}
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: '13px' }}>{t('Contenu')}</label>
                  <textarea
                    style={{ ...inputStyle, minHeight: '100px', resize: 'vertical', fontSize: '13px' }}
                    value={mod.contenu}
                    onChange={e => updateModule(idx, 'contenu', e.target.value)}
                    placeholder={t('Contenu du module...')}
                  />
                </div>
                <div style={{ maxWidth: '180px' }}>
                  <label style={{ ...labelStyle, fontSize: '13px' }}>Durée (minutes) *</label>
                  <input
                    style={{ ...inputStyle, borderColor: (!mod.duree_minutes || mod.duree_minutes <= 0) ? '#ef4444' : '#d1d5db' }}
                    type="number"
                    min={5}
                    max={480}
                    value={mod.duree_minutes}
                    onChange={e => updateModule(idx, 'duree_minutes', Number(e.target.value))}
                  />
                  {(!mod.duree_minutes || mod.duree_minutes <= 0) && <p style={{ color: '#dc2626', fontSize: '12px', margin: '2px 0 0' }}>Durée requise &gt; 0</p>}
                </div>
                {/* Leçons du module */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ ...labelStyle, fontSize: '13px', marginBottom: 0 }}>Leçons ({(mod.lecons || []).length})</label>
                    <button
                      onClick={() => {
                        const updated = [...modules]
                        updated[idx] = { ...updated[idx], lecons: [...(updated[idx].lecons || []), { titre: '', description: '' }] }
                        setModules(updated)
                      }}
                      style={{ ...btnSecondaryStyle, fontSize: '12px', padding: '4px 10px' }}
                    >
                      {t('+ Ajouter une leçon')}
                    </button>
                  </div>
                  {(mod.lecons || []).length === 0 && (
                    <p style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>Aucune leçon — cliquez sur &quot;+ Ajouter une leçon&quot;</p>
                  )}
                  {(mod.lecons || []).map((lecon, leconIdx) => {
                    const leconImgId = 'img-lecon-' + idx + '-' + leconIdx
                    return (
                      <div key={leconIdx} style={{ border: '1px solid #d1d5db', borderRadius: '6px', padding: '10px', marginBottom: '8px', background: '#fff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <button onClick={() => moveLecon(idx, leconIdx, -1)} style={{ ...btnMoveStyle, fontSize: '11px', padding: '1px 5px' }} disabled={leconIdx === 0} title={t('Monter')}>▲</button>
                              <button onClick={() => moveLecon(idx, leconIdx, 1)} style={{ ...btnMoveStyle, fontSize: '11px', padding: '1px 5px' }} disabled={leconIdx === (mod.lecons || []).length - 1} title={t('Descendre')}>▼</button>
                            </div>
                            <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>{t('Leçon')}{' '}{leconIdx + 1}</span>
                          </div>
                          <button
                            onClick={() => {
                              const updated = [...modules]
                              const newLecons = updated[idx].lecons.filter((_, i) => i !== leconIdx)
                              updated[idx] = { ...updated[idx], lecons: newLecons }
                              setModules(updated)
                            }}
                            style={{ ...btnDangerStyle, fontSize: '11px', padding: '2px 8px' }}
                          >
                            {t('Supprimer')}
                          </button>
                        </div>
                        <input
                          style={{ ...inputStyle, marginBottom: '6px', fontSize: '13px', borderColor: !lecon.titre.trim() ? '#ef4444' : '#d1d5db' }}
                          value={lecon.titre}
                          onChange={e => {
                            const updated = [...modules]
                            updated[idx].lecons[leconIdx] = { ...updated[idx].lecons[leconIdx], titre: e.target.value }
                            setModules(updated)
                          }}
                          placeholder={t('Titre de la leçon *')}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                          <input
                            type="number"
                            min={0}
                            style={{ ...inputStyle, width: '80px', fontSize: '12px', padding: '4px 8px' }}
                            value={lecon.duree_minutes || ''}
                            onChange={e => {
                              const updated = [...modules]
                              updated[idx].lecons[leconIdx] = { ...updated[idx].lecons[leconIdx], duree_minutes: parseInt(e.target.value) || 0 }
                              setModules(updated)
                            }}
                            placeholder={t('min')}
                          />
                          <span style={{ fontSize: '11px', color: '#6b7280' }}>{t('min / leçon')}</span>
                        </div>
                        {!lecon.titre.trim() && <p style={{ color: '#dc2626', fontSize: '12px', margin: '-4px 0 6px' }}>{t('Titre requis')}</p>}
                        <textarea
                          style={{ ...inputStyle, minHeight: '70px', resize: 'vertical', fontSize: '13px' }}
                          value={lecon.description}
                          onChange={e => {
                            const updated = [...modules]
                            updated[idx].lecons[leconIdx] = { ...updated[idx].lecons[leconIdx], description: e.target.value }
                            setModules(updated)
                          }}
                          placeholder={t('Description de la leçon...')}
                        />
                        {/* Blocs de contenu enrichis */}
                        {(lecon.blocs || []).length > 0 && (
                          <div style={{ marginTop: '8px' }}>
                            {(lecon.blocs || []).map((bloc: any, bi: number) => (
                              <div key={bi} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px', marginBottom: '6px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                <span style={{ fontSize: '14px', flexShrink: 0 }}>
                                  {bloc.type === 'video' ? '🎬' : bloc.type === 'file' ? '📎' : bloc.type === 'code' ? '💻' : bloc.type === 'link' ? '🔗' : '📝'}
                                </span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px', fontWeight: '600', textTransform: 'uppercase' }}>{bloc.type}</div>
                                  <input style={{ ...inputStyle, fontSize: '12px' }} value={bloc.contenu} onChange={e => { const updated = [...modules]; const b = [...(updated[idx].lecons[leconIdx].blocs || [])]; b[bi] = { ...b[bi], contenu: e.target.value }; updated[idx].lecons[leconIdx] = { ...updated[idx].lecons[leconIdx], blocs: b }; setModules(updated) }} placeholder={bloc.type === 'video' ? 'URL YouTube/Vimeo' : bloc.type === 'file' ? t('URL du PDF') : bloc.type === 'link' ? t('URL du lien') : 'Code...'} />
                                </div>
                                <button onClick={() => { const updated = [...modules]; const b = (updated[idx].lecons[leconIdx].blocs || []).filter((_: any, i: number) => i !== bi); updated[idx].lecons[leconIdx] = { ...updated[idx].lecons[leconIdx], blocs: b }; setModules(updated) }} style={{ ...btnDangerStyle, fontSize: '10px', padding: '2px 6px', flexShrink: 0 }}>{t('×')}</button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                          {(['video', 'file', 'code', 'link'] as const).map(type => (
                            <button key={type} onClick={() => { const updated = [...modules]; const blocs = [...(updated[idx].lecons[leconIdx].blocs || []), { type, contenu: '' }]; updated[idx].lecons[leconIdx] = { ...updated[idx].lecons[leconIdx], blocs }; setModules(updated) }} style={{ background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer', color: '#374151' }}>
                              + {type === 'video' ? t('🎬 Vidéo') : type === 'file' ? '📎 PDF' : type === 'code' ? '💻 Code' : '🔗 Lien'}
                            </button>
                          ))}
                        </div>
                                                {/* Image de la leçon */}
                        <div style={{ marginTop: '8px' }}>
                          {lecon.image_url ? (
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <img
                                src={lecon.image_url}
                                alt={t('Aperçu')}
                                style={{ maxWidth: '200px', maxHeight: '120px', borderRadius: '4px', border: '1px solid #d1d5db', display: 'block' }}
                              />
                              <button
                                onClick={() => {
                                  const updated = [...modules]
                                  const lec = { ...updated[idx].lecons[leconIdx] }
                                  delete lec.image_url
                                  updated[idx].lecons[leconIdx] = lec
                                  setModules(updated)
                                }}
                                style={{ ...btnDangerStyle, fontSize: '11px', padding: '2px 8px', marginTop: '4px' }}
                              >
                                Retirer l&apos;image
                              </button>
                            </div>
                          ) : (
                            <label
                              htmlFor={leconImgId}
                              style={{ ...btnSecondaryStyle, fontSize: '12px', padding: '4px 10px', cursor: 'pointer', display: 'inline-block' }}
                            >
                              {t('+ Ajouter une image')}
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

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button onClick={() => setStep('upload')} style={btnSecondaryStyle}>
            {t('Annuler')}
          </button>
          <button onClick={() => setStep('quiz')} style={btnPrimaryStyle}>
            → Questionnaire &amp; Créer
          </button>

            {/* Prérequis */}
            <div>
              <label style={labelStyle}>Prérequis (formations obligatoires avant)</label>
              <p style={{ fontSize: '11px', color: '#9ca3af', margin: '0 0 6px' }}>Sélectionnez les formations que l&apos;apprenant doit avoir terminées avant d&apos;accéder à celle-ci.</p>
              {formationsDisponibles.length === 0 ? (
                <p style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>{t('Aucune formation publiée disponible.')}</p>
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
                <p style={{ fontSize: '11px', color: '#7c3aed', margin: '4px 0 0' }}>✓ {prerequisIds.length}{' '}{t('prérequis sélectionné')}{prerequisIds.length > 1 ? 's' : ''}</p>
              )}
            </div>
        </div>
      </div>
    )
  }

  // STEP: Quiz
  if (step === 'quiz') {
    return (
      <div style={containerStyle}>
        <div style={{ marginBottom: '24px' }}>
          <button onClick={() => setStep('review')} style={{ ...btnSecondaryStyle, padding: '6px 14px', fontSize: '13px' }}>
            {t('← Retour aux modules')}
          </button>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: '12px 0 4px' }}>
            Questionnaire d&apos;évaluation
          </h1>
          <p style={{ color: '#6b7280', fontSize: '13px', margin: 0 }}>
            {t('Optionnel — ajoutez des questions QCM pour évaluer les apprenants à la fin de la formation.')}
          </p>
        </div>

        <div style={{ ...cardStyle, marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#111827', margin: 0 }}>
              Questions ({questions.length})
            </h2>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <label style={{ fontSize: '13px', color: '#374151' }}>{t('Seuil réussite :')}</label>
              <input
                type="number"
                min={0}
                max={100}
                value={seuilReussite}
                onChange={e => setSeuilReussite(Number(e.target.value))}
                style={{ width: '70px', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}
              />
              <span style={{ fontSize: '13px', color: '#374151' }}>%</span>
              <button
                onClick={() => setQuestions(prev => [...prev, { texte: '', reponses: [{ texte: '', est_correcte: true }, { texte: '', est_correcte: false }, { texte: '', est_correcte: false }] }])}
                style={{ ...btnPrimaryStyle, padding: '6px 12px', fontSize: '13px' }}
              >
                {t('+ Question')}
              </button>
            </div>
          </div>

          {questions.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px', color: '#9ca3af', fontSize: '14px' }}>
              <p style={{ margin: '0 0 8px' }}>{t('Aucune question — la formation sera créée sans questionnaire.')}</p>
              <p style={{ margin: 0, fontSize: '12px' }}>{t('Vous pourrez en ajouter plus tard depuis la page de la formation.')}</p>
            </div>
          )}

          {questions.map((q, qi) => (
            <div key={qi} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '14px', marginBottom: '10px', background: '#f9fafb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#6b7280' }}>{t('Question')}{' '}{qi + 1}</span>
                <button
                  onClick={() => setQuestions(prev => prev.filter((_, i) => i !== qi))}
                  style={{ background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '4px', padding: '3px 8px', fontSize: '12px', cursor: 'pointer' }}
                >
                  {t('Supprimer')}
                </button>
              </div>
              <input
                style={{ width: '100%', padding: '8px 12px', border: '1px solid ' + (!q.texte.trim() ? '#ef4444' : '#d1d5db'), borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '8px' }}
                value={q.texte}
                onChange={e => setQuestions(prev => prev.map((q2, i) => i === qi ? { ...q2, texte: e.target.value } : q2))}
                placeholder={t('Texte de la question... *')}
              />
              {!q.texte.trim() && <p style={{ color: '#dc2626', fontSize: '12px', margin: '-4px 0 8px' }}>{t('Le texte est requis')}</p>}
              {q.reponses.map((r, ri) => (
                <div key={ri} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                  <input
                    type="radio"
                    checked={r.est_correcte}
                    onChange={() => setQuestions(prev => prev.map((q2, i) => i !== qi ? q2 : { ...q2, reponses: q2.reponses.map((r2, j) => ({ ...r2, est_correcte: j === ri })) }))}
                    style={{ cursor: 'pointer' }}
                  />
                  <input
                    style={{ flex: 1, padding: '6px 10px', border: '1px solid ' + (!r.texte.trim() ? '#ef4444' : '#d1d5db'), borderRadius: '6px', fontSize: '13px' }}
                    value={r.texte}
                    onChange={e => setQuestions(prev => prev.map((q2, i) => i !== qi ? q2 : { ...q2, reponses: q2.reponses.map((r2, j) => j === ri ? { ...r2, texte: e.target.value } : r2) }))}
                    placeholder={'Réponse ' + (ri + 1) + (r.est_correcte ? ' ✓ correcte' : '')}
                  />
                  {q.reponses.length > 2 && (
                    <button
                      onClick={() => setQuestions(prev => prev.map((q2, i) => i !== qi ? q2 : { ...q2, reponses: q2.reponses.filter((_, j) => j !== ri) }))}
                      style={{ background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '4px', padding: '3px 6px', fontSize: '11px', cursor: 'pointer' }}
                    >✕</button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setQuestions(prev => prev.map((q2, i) => i !== qi ? q2 : { ...q2, reponses: [...q2.reponses, { texte: '', est_correcte: false }] }))}
                style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer', marginTop: '4px' }}
              >
                {t('+ Réponse')}
              </button>
            </div>
          ))}
        </div>

        {error && (
          <p style={{ color: '#dc2626', fontSize: '14px', marginBottom: '16px', background: '#fee2e2', padding: '10px', borderRadius: '6px' }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button onClick={() => setStep('review')} style={btnSecondaryStyle}>
            {t('Annuler')}
          </button>
          <button onClick={() => setShowPreview(true)} style={btnPrimaryStyle}>
            {t('✓ Créer la formation')}
          </button>
        </div>
      </div>
    )
  }

  // PREVIEW MODAL
  if (showPreview) {
    const totalLecons = modules.reduce((sum, m) => sum + (m.lecons || []).length, 0)
    const validQs = questions.filter(q => q.texte.trim())
    return (
      <div style={{ maxWidth: '600px', margin: '40px auto', padding: '32px', background: '#fff', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.1)' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', margin: '0 0 4px' }}>{t('Aperçu avant création')}</h2>
        <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 24px' }}>{t('Vérifiez le récapitulatif avant de soumettre.')}</p>
        {error && <p role="alert" style={{ color: '#dc2626', background: '#fee2e2', padding: '10px', borderRadius: '6px', margin: '0 0 16px', fontSize: '14px' }}>{error}</p>}
        <div style={{ display: 'grid', gap: '14px', marginBottom: '24px' }}>
          <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
            <div className='grille-2-colonnes' style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><span style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase' }}>{t('Titre')}</span><p style={{ fontSize: '15px', fontWeight: '600', color: '#111827', margin: '4px 0 0' }}>{titre}</p></div>
              <div><span style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase' }}>{t('Niveau')}</span><p style={{ fontSize: '14px', color: '#374151', margin: '4px 0 0', textTransform: 'capitalize' }}>{niveau}</p></div>
              <div><span style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase' }}>{t('Modules')}</span><p style={{ fontSize: '14px', color: '#374151', margin: '4px 0 0' }}>{modules.length} module{modules.length > 1 ? 's' : ''}</p></div>
              <div><span style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase' }}>{t('Leçons')}</span><p style={{ fontSize: '14px', color: '#374151', margin: '4px 0 0' }}>{totalLecons} leçon{totalLecons > 1 ? 's' : ''}</p></div>
              <div><span style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase' }}>{t('Durée')}</span><p style={{ fontSize: '14px', color: '#374151', margin: '4px 0 0' }}>{formatDuree(Math.round(dureeHeures * 60))}</p></div>
            </div>
          </div>
          {(tags.length > 0 || objectifs.length > 0) && (
            <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
              {tags.length > 0 && <div style={{ marginBottom: '8px' }}><span style={{ fontSize: '12px', fontWeight: '600' }}>{t('Tags')}</span><div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>{tags.map((t, i) => <span key={i} style={{ background: '#ede9fe', color: '#5b21b6', fontSize: '11px', padding: '1px 8px', borderRadius: '20px' }}>{t}</span>)}</div></div>}
              {objectifs.length > 0 && <div><span style={{ fontSize: '12px', fontWeight: '600' }}>Objectifs ({objectifs.length})</span>{objectifs.map((o, i) => <p key={i} style={{ fontSize: '12px', color: '#374151', margin: '4px 0 0' }}>✓ {o}</p>)}</div>}
            </div>
          )}
          {prerequisIds.length > 0 && (
            <div style={{ padding: '12px 16px', background: '#fefce8', borderRadius: '10px', border: '1px solid #fef08a' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#713f12' }}>⚠️ {prerequisIds.length}{' '}{t('prérequis obligatoire')}{prerequisIds.length > 1 ? 's' : ''}</span>
            </div>
          )}
          {validQs.length > 0 && (
            <div style={{ padding: '12px 16px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#15803d' }}>{t('✓ Questionnaire :')}{' '}{validQs.length} question{validQs.length > 1 ? 's' : ''}{t(', seuil')}{' '}{seuilReussite}%</span>
            </div>
          )}
        </div>
        <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>{t('La formation est créée en brouillon. Elle devra être approuvée par un validateur avant d’être publiée.')}</p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button onClick={() => setShowPreview(false)} style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', padding: '10px 20px', fontSize: '14px', cursor: 'pointer', fontWeight: '500' }}>{t('← Modifier')}</button>
          <button onClick={handleSubmit} style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 2px 8px rgba(124,58,237,0.35)' }}>{t('✓ Confirmer et créer')}</button>
        </div>
      </div>
    )
  }

  // STEP: Creating
  if (step === 'creating') {
    return (
      <div style={{ ...containerStyle, textAlign: 'center', paddingTop: '80px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
        <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#111827' }}>{t('Création en cours...')}</h2>
        <p style={{ color: '#6b7280' }}>{t('La formation et ses modules sont en cours de création.')}</p>
      </div>
    )
  }

  // STEP: Done
  return (
    <div style={{ ...containerStyle, textAlign: 'center', paddingTop: '60px' }}>
      <div style={cardStyle}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>✅</div>
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: '0 0 8px' }}>
          {t('Formation créée avec succès!')}
        </h2>
        <p style={{ color: '#6b7280', marginBottom: '28px' }}>
          {t('La formation')} <strong>{titre}</strong>{t('a été créée avec')}{' '}{modules.length} module(s).
          Elle est en brouillon — vous pouvez maintenant l&apos;éditer et la publier.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button onClick={() => router.push('/admin/formations/nouvelle?formation=' + formationId)} style={btnPrimaryStyle}>
            {t('🎨 Ajouter le contenu des leçons')}
          </button>
          <button onClick={() => router.push('/admin/formations/' + formationId)} style={btnSecondaryStyle}>
            {t('Voir la formation')}
          </button>
          <button onClick={() => router.push('/admin/formations')} style={btnSecondaryStyle}>
            {t('Liste des formations')}
          </button>
          <button onClick={() => { setStep('upload'); setFileName(''); setModules([]); setTitre(''); setDescription(''); setTags([]); setObjectifs([]); setPrerequisIds([]); setImageCouverture(null) }} style={btnSecondaryStyle}>
            {t('Générer une autre')}
          </button>
        </div>
      </div>
    </div>
  )
}
