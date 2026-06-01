'use client'

import { useState, useCallback, useEffect } from 'react'
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
  duree_minutes?: number
}

interface ModuleData {
  titre: string
  contenu: string
  duree_minutes: number
  lecons: LeconData[]
}

function parseDocumentIntoModules(text: string): { titre: string; description: string; modules: ModuleData[] } {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)

  // --- Detect PowerPoint PDF format (=== Diapositive markers added by PDF extractor) ---
  const slidePattern = /^===\s*Diapositive\s+(\d+)\s*\/\s*(\d+)\s*===$/i
  const isPptPdf = lines.some(l => slidePattern.test(l))

  if (isPptPdf) {
    const slides: Array<{ num: number; total: number; content: string[] }> = []
    let currentSlide: { num: number; total: number; content: string[] } | null = null

    for (const line of lines) {
      const m = slidePattern.exec(line)
      if (m) {
        if (currentSlide) slides.push(currentSlide)
        currentSlide = { num: parseInt(m[1]), total: parseInt(m[2]), content: [] }
      } else if (currentSlide) {
        if (!line.match(/^Narration$/i) && !line.match(/^Diapositive\s+\d+\s*\/\s*\d+$/i)) {
          currentSlide.content.push(line)
        }
      }
    }
    if (currentSlide) slides.push(currentSlide)

    if (slides.length === 0) {
      return { titre: 'Formation sans titre', description: '', modules: [{ titre: 'Module 1', contenu: '', duree_minutes: 30, lecons: [] }] }
    }

    const firstSlideContent = slides[0]?.content || []
    const docTitle = firstSlideContent[0]?.substring(0, 100) || 'Formation'
    const docDescription = firstSlideContent.slice(1, 4).join(' ').substring(0, 300)

    const totalSlides = slides.length
    const numModules = Math.max(1, Math.round(totalSlides / 5))
    const slidesPerModule = Math.ceil(totalSlides / numModules)
    const pptModules: ModuleData[] = []

    for (let i = 0; i < slides.length; i += slidesPerModule) {
      const moduleSlides = slides.slice(i, i + slidesPerModule)
      const moduleNum = Math.floor(i / slidesPerModule) + 1
      const firstContent = moduleSlides[0]?.content || []
      const moduleTitre = firstContent[0]?.substring(0, 80) || ('Module ' + moduleNum)

      const lecons: LeconData[] = moduleSlides.map(slide => {
        const sc = slide.content
        const leconTitre = sc[0]?.substring(0, 80) || ('Diapositive ' + slide.num)
        const leconDesc = sc.slice(1).join('\n').substring(0, 500)
        return { titre: leconTitre, description: leconDesc, duree_minutes: 5 }
      })

      const contenu = moduleSlides.map(s => s.content.join('\n')).join('\n\n')
      pptModules.push({
        titre: moduleTitre,
        contenu: contenu.substring(0, 1000),
        duree_minutes: Math.max(15, lecons.length * 5),
        lecons,
      })
    }

    return { titre: docTitle, description: docDescription, modules: pptModules }
  }

  // --- Standard document parsing (txt, md, etc.) ---
  let docTitle = ''
  let docDescription = ''
  const modules: ModuleData[] = []

  const isHeading = (line: string) => {
    return (
      /^#{1,3}\s+.+/.test(line) ||
      /^\d+\.\s+.{3,}/.test(line) ||
      /^[A-Z][A-Z\s]{4,}:?$/.test(line) ||
      /^={3,}|-{3,}/.test(line) ||
      /^(Section|Chapitre|Partie|Module|Étape|Step|Article)\s+\d+/i.test(line)
    )
  }

  const cleanHeading = (line: string) =>
    line.replace(/^#{1,3}\s+/, '').replace(/^\d+\.\s+/, '').replace(/:$/, '').trim()

  let currentModule: ModuleData | null = null
  let firstHeadingFound = false
  let preambleLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (!firstHeadingFound) {
      if (isHeading(line)) {
        firstHeadingFound = true
        if (!docTitle) {
          docTitle = cleanHeading(line)
        } else {
          currentModule = { titre: cleanHeading(line), contenu: '', duree_minutes: 30, lecons: [] }
        }
        docDescription = preambleLines.join(' ').substring(0, 300)
        preambleLines = []
      } else {
        if (!docTitle) {
          docTitle = line
        } else {
          preambleLines.push(line)
        }
      }
      continue
    }

    if (isHeading(line)) {
      if (currentModule && (currentModule.titre || currentModule.contenu)) {
        modules.push(currentModule)
      }
      currentModule = { titre: cleanHeading(line), contenu: '', duree_minutes: 30, lecons: [] }
    } else {
      if (!currentModule) {
        currentModule = { titre: 'Introduction', contenu: '', duree_minutes: 30, lecons: [] }
      }
      currentModule.contenu += (currentModule.contenu ? '\n' : '') + line
    }
  }

  if (currentModule && (currentModule.titre || currentModule.contenu)) {
    modules.push(currentModule)
  }

  if (modules.length === 0 && lines.length > 0) {
    if (!docTitle) docTitle = lines[0]
    const chunks = text.split(/\n{2,}/).filter(c => c.trim().length > 20)
    chunks.forEach((chunk, i) => {
      const chunkLines = chunk.split('\n').map(l => l.trim()).filter(Boolean)
      modules.push({
        titre: chunkLines[0].substring(0, 80) || ('Section ' + (i + 1)),
        contenu: chunkLines.slice(1).join('\n').substring(0, 1000),
        duree_minutes: 30,
        lecons: [],
      })
    })
  }

  modules.forEach(m => {
    const wordCount = m.contenu.split(/\s+/).length
    m.duree_minutes = Math.max(15, Math.min(120, Math.round(wordCount / 10) * 5))
  })

  return { titre: docTitle || 'Formation sans titre', description: docDescription, modules }
}

type Step = 'upload' | 'review' | 'quiz' | 'creating' | 'done'

export default function GenererFormationPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('upload')
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  const [categorie, setCategorie] = useState(CATEGORIES[0])
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
  const [publierImmediatement, setPublierImmediatement] = useState(false)

  // Durée auto-calculée depuis les modules
  useEffect(() => {
    if (!dureeManuelle && modules.length > 0) {
      const totalMinutes = modules.reduce((sum, m) => sum + (m.duree_minutes || 0), 0)
      const heures = Math.max(1, Math.round(totalMinutes / 60 * 10) / 10)
      setDureeHeures(heures)
    }
  }, [modules, dureeManuelle])
  // Load existing formations for prerequis selector
  useEffect(() => {
    const supabase = createClient()
    supabase.from('formations').select('id, titre').eq('est_publiee', true).order('titre').then(({ data }) => {
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
            .map((item: { str?: string }) => item.str ?? '')
            .join(' ')
          fullText += '\n=== Diapositive ' + i + ' / ' + pdf.numPages + ' ===\n' + pageText + '\n'
        }

        const parsed = parseDocumentIntoModules(fullText)
        setTitre(parsed.titre)
        setDescription(parsed.description)
        setModules(parsed.modules.length > 0 ? parsed.modules : [{ titre: 'Module 1', contenu: '', duree_minutes: 30, lecons: [] }])
        setStep('review')
      } catch (err) {
        console.error('PDF error:', err)
        setError("Erreur lors de la lecture du PDF. Vérifiez que le fichier n'est pas protégé.")
      }
    } else {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = (e.target?.result as string) || ''
        const parsed = parseDocumentIntoModules(text)
        setTitre(parsed.titre)
        setDescription(parsed.description)
        setModules(parsed.modules.length > 0 ? parsed.modules : [{ titre: 'Module 1', contenu: '', duree_minutes: 30, lecons: [] }])
        setStep('review')
      }
      reader.onerror = () => setError('Erreur lors de la lecture du fichier.')
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
    if (!titre.trim()) errors.push('Le titre de la formation est requis.')
    if (modules.length === 0) errors.push('Au moins un module est requis.')
    const emptyModules = modules.filter(m => !m.titre.trim())
    if (emptyModules.length > 0) errors.push('Chaque module doit avoir un titre.')
    const invalidDurations = modules.filter(m => !m.duree_minutes || m.duree_minutes <= 0)
    if (invalidDurations.length > 0) errors.push('Chaque module doit avoir une durée supérieure à 0.')
    const emptyLecons = modules.flatMap(m => m.lecons || []).filter(l => !l.titre.trim())
    if (emptyLecons.length > 0) errors.push('Chaque leçon doit avoir un titre.')
    if (questions.length > 0) {
      const emptyQ = questions.filter(q => !q.texte.trim())
      if (emptyQ.length > 0) errors.push('Chaque question du questionnaire doit avoir un texte.')
      const noCorrect = questions.filter(q => !q.reponses.some(r => r.est_correcte))
      if (noCorrect.length > 0) errors.push('Chaque question doit avoir au moins une réponse correcte.')
      const emptyR = questions.filter(q => q.reponses.some(r => !r.texte.trim()))
      if (emptyR.length > 0) errors.push('Chaque réponse doit avoir un texte.')
    }
    if (errors.length > 0) { setError(errors.join(' | ')); return }

    setStep('creating')
    setError('')

    try {
      const res = await fetch('/api/generer-formation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titre, description, categorie, niveau, duree_heures: dureeHeures, modules, questionnaire: questions.length > 0 ? { seuil_reussite: seuilReussite, questions } : null, tags, objectifs, prerequis_ids: prerequisIds, image_couverture: imageCouverture, publier_immediatement: publierImmediatement }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erreur lors de la création.')
        setStep('review')
        return
      }
      setFormationId(data.formation_id)
      localStorage.removeItem('generer-formation-draft')
      setStep('done')
    } catch {
      setError('Erreur réseau.')
      setStep('review')
    }
  }

  const containerStyle: React.CSSProperties = {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '32px 24px',
    fontFamily: 'system-ui, sans-serif',
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
    background: '#2563eb',
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
          <a href="/admin/formations" style={{ color: '#6b7280', fontSize: '14px', textDecoration: 'none' }}>
            ← Retour aux formations
          </a>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: '8px 0 4px' }}>
            Générer une formation depuis un document
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
              border: '2px dashed ' + (dragging ? '#2563eb' : '#d1d5db'),
              borderRadius: '12px',
              padding: '48px 32px',
              textAlign: 'center',
              background: dragging ? '#eff6ff' : '#f9fafb',
              transition: 'all 0.2s',
              cursor: 'pointer',
            }}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
            <p style={{ fontSize: '16px', fontWeight: '600', color: '#374151', margin: '0 0 8px' }}>
              Glissez votre document ici
            </p>
            <p style={{ fontSize: '14px', color: '#9ca3af', margin: '0 0 20px' }}>
              ou cliquez pour sélectionner un fichier
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
              <strong>Conseil :</strong> Pour de meilleurs résultats, utilisez un document avec des titres de sections clairs
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
    const autoHeures = Math.max(1, Math.round(totalMinutes / 60 * 10) / 10)

    return (
      <div style={containerStyle}>
        <div style={{ marginBottom: '24px' }}>
          <button onClick={() => setStep('upload')} style={{ ...btnSecondaryStyle, padding: '6px 14px', fontSize: '13px' }}>
            ← Changer de fichier
          </button>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: '12px 0 4px' }}>
            Vérifier et ajuster la formation
          </h1>
          <p style={{ color: '#6b7280', fontSize: '13px', margin: 0 }}>
            Fichier: <strong>{fileName}</strong> — {modules.length} module(s) détecté(s)
          </p>
        </div>

        {error && (
          <p style={{ color: '#dc2626', fontSize: '14px', marginBottom: '16px', background: '#fee2e2', padding: '10px', borderRadius: '6px' }}>
            {error}
          </p>
        )}

        <div style={{ ...cardStyle, marginBottom: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#111827', margin: '0 0 20px' }}>
            Informations générales
          </h2>
          <div style={{ display: 'grid', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Titre de la formation *</label>
              <input style={inputStyle} value={titre} onChange={e => setTitre(e.target.value)} placeholder="Titre de la formation" />
            </div>
            <div>
              <label style={labelStyle}>Description</label>
              <textarea
                style={{ ...inputStyle, minHeight: '120px', resize: 'vertical' }}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Description de la formation... (Astuce : utilisez des retours à la ligne pour structurer, ex: \n\n- Point 1\n- Point 2)"
              />
              <span style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px', display: 'block' }}>Mise en forme: **gras**, *italique*, - liste, laisser une ligne vide entre paragraphes</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Catégorie</label>
                <select style={selectStyle} value={categorie} onChange={e => setCategorie(e.target.value)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Niveau</label>
                <select style={selectStyle} value={niveau} onChange={e => setNiveau(e.target.value)}>
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
                      style={{ ...btnSecondaryStyle, padding: '8px 10px', fontSize: '12px', whiteSpace: 'nowrap' }}
                      title="Recalculer automatiquement"
                    >
                      🔄 Auto
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
            Enrichissement
          </h2>
          <div style={{ display: 'grid', gap: '20px' }}>

            {/* Image de couverture */}
            <div>
              <label style={labelStyle}>Image de couverture</label>
              {imageCouverture ? (
                <div>
                  <img src={imageCouverture} alt="Couverture" style={{ maxWidth: '240px', maxHeight: '140px', borderRadius: '8px', border: '1px solid #e5e7eb', display: 'block', marginBottom: '8px' }} />
                  <button onClick={() => setImageCouverture(null)} style={btnDangerStyle}>Retirer</button>
                </div>
              ) : (
                <label htmlFor="cover-img" style={{ ...btnSecondaryStyle, display: 'inline-block', cursor: 'pointer', fontSize: '13px' }}>
                  + Ajouter une image de couverture
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
              <label style={labelStyle}>Tags / mots-clés</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                {tags.map((tag, ti) => (
                  <span key={ti} style={{ background: '#ede9fe', color: '#5b21b6', fontSize: '12px', padding: '3px 10px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {tag}
                    <button onClick={() => setTags(prev => prev.filter((_, i) => i !== ti))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7c3aed', fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) { e.preventDefault(); setTags(prev => [...prev, tagInput.trim()]); setTagInput('') } }}
                  placeholder="Ajouter un tag (Entrée ou virgule)"
                />
                <button onClick={() => { if (tagInput.trim()) { setTags(prev => [...prev, tagInput.trim()]); setTagInput('') } }} style={{ ...btnSecondaryStyle, padding: '10px 14px' }}>+</button>
              </div>
            </div>

            {/* Objectifs pédagogiques */}
            <div>
              <label style={labelStyle}>Objectifs pédagogiques</label>
              <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 8px' }}>À la fin de cette formation, l&apos;apprenant saura...</p>
              {objectifs.map((obj, oi) => (
                <div key={oi} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'flex-start' }}>
                  <span style={{ color: '#10b981', marginTop: '2px' }}>✓</span>
                  <span style={{ flex: 1, fontSize: '14px', color: '#374151' }}>{obj}</span>
                  <button onClick={() => setObjectifs(prev => prev.filter((_, i) => i !== oi))} style={{ ...btnDangerStyle, fontSize: '11px', padding: '2px 6px' }}>×</button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={objectifInput}
                  onChange={e => setObjectifInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && objectifInput.trim()) { e.preventDefault(); setObjectifs(prev => [...prev, objectifInput.trim()]); setObjectifInput('') } }}
                  placeholder="Ex: utiliser le logiciel X de manière autonome"
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
              + Ajouter un module
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
                    <button onClick={() => moveModule(idx, -1)} style={btnMoveStyle} disabled={idx === 0} title="Monter">▲</button>
                    <button onClick={() => moveModule(idx, 1)} style={btnMoveStyle} disabled={idx === modules.length - 1} title="Descendre">▼</button>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#6b7280' }}>Module {idx + 1}</span>
                </div>
                <button onClick={() => removeModule(idx)} style={btnDangerStyle}>
                  Supprimer
                </button>
              </div>
              <div style={{ display: 'grid', gap: '10px' }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: '13px' }}>Titre *</label>
                  <input
                    style={{ ...inputStyle, borderColor: !mod.titre.trim() ? '#ef4444' : '#d1d5db' }}
                    value={mod.titre}
                    onChange={e => updateModule(idx, 'titre', e.target.value)}
                    placeholder="Titre du module"
                  />
                  {!mod.titre.trim() && <p style={{ color: '#dc2626', fontSize: '12px', margin: '2px 0 0' }}>Le titre est requis</p>}
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: '13px' }}>Contenu</label>
                  <textarea
                    style={{ ...inputStyle, minHeight: '100px', resize: 'vertical', fontSize: '13px' }}
                    value={mod.contenu}
                    onChange={e => updateModule(idx, 'contenu', e.target.value)}
                    placeholder="Contenu du module..."
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
                      + Ajouter une leçon
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
                              <button onClick={() => moveLecon(idx, leconIdx, -1)} style={{ ...btnMoveStyle, fontSize: '11px', padding: '1px 5px' }} disabled={leconIdx === 0} title="Monter">▲</button>
                              <button onClick={() => moveLecon(idx, leconIdx, 1)} style={{ ...btnMoveStyle, fontSize: '11px', padding: '1px 5px' }} disabled={leconIdx === (mod.lecons || []).length - 1} title="Descendre">▼</button>
                            </div>
                            <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Leçon {leconIdx + 1}</span>
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
                            Supprimer
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
                          placeholder="Titre de la leçon *"
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
                            placeholder="min"
                          />
                          <span style={{ fontSize: '11px', color: '#6b7280' }}>min / leçon</span>
                        </div>
                        {!lecon.titre.trim() && <p style={{ color: '#dc2626', fontSize: '12px', margin: '-4px 0 6px' }}>Titre requis</p>}
                        <textarea
                          style={{ ...inputStyle, minHeight: '70px', resize: 'vertical', fontSize: '13px' }}
                          value={lecon.description}
                          onChange={e => {
                            const updated = [...modules]
                            updated[idx].lecons[leconIdx] = { ...updated[idx].lecons[leconIdx], description: e.target.value }
                            setModules(updated)
                          }}
                          placeholder="Description de la leçon..."
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
                                  <input style={{ ...inputStyle, fontSize: '12px' }} value={bloc.contenu} onChange={e => { const updated = [...modules]; const b = [...(updated[idx].lecons[leconIdx].blocs || [])]; b[bi] = { ...b[bi], contenu: e.target.value }; updated[idx].lecons[leconIdx] = { ...updated[idx].lecons[leconIdx], blocs: b }; setModules(updated) }} placeholder={bloc.type === 'video' ? 'URL YouTube/Vimeo' : bloc.type === 'file' ? 'URL du PDF' : bloc.type === 'link' ? 'URL du lien' : 'Code...'} />
                                </div>
                                <button onClick={() => { const updated = [...modules]; const b = (updated[idx].lecons[leconIdx].blocs || []).filter((_: any, i: number) => i !== bi); updated[idx].lecons[leconIdx] = { ...updated[idx].lecons[leconIdx], blocs: b }; setModules(updated) }} style={{ ...btnDangerStyle, fontSize: '10px', padding: '2px 6px', flexShrink: 0 }}>×</button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                          {(['video', 'file', 'code', 'link'] as const).map(type => (
                            <button key={type} onClick={() => { const updated = [...modules]; const blocs = [...(updated[idx].lecons[leconIdx].blocs || []), { type, contenu: '' }]; updated[idx].lecons[leconIdx] = { ...updated[idx].lecons[leconIdx], blocs }; setModules(updated) }} style={{ background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer', color: '#374151' }}>
                              + {type === 'video' ? '🎬 Vidéo' : type === 'file' ? '📎 PDF' : type === 'code' ? '💻 Code' : '🔗 Lien'}
                            </button>
                          ))}
                        </div>
                                                {/* Image de la leçon */}
                        <div style={{ marginTop: '8px' }}>
                          {lecon.image_url ? (
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <img
                                src={lecon.image_url}
                                alt="Aperçu"
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
                              + Ajouter une image
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
            Annuler
          </button>
          <button onClick={() => setStep('quiz')} style={btnPrimaryStyle}>
            → Questionnaire &amp; Créer
          </button>

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
      </div>
    )
  }

  // STEP: Quiz
  if (step === 'quiz') {
    return (
      <div style={containerStyle}>
        <div style={{ marginBottom: '24px' }}>
          <button onClick={() => setStep('review')} style={{ ...btnSecondaryStyle, padding: '6px 14px', fontSize: '13px' }}>
            ← Retour aux modules
          </button>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: '12px 0 4px' }}>
            Questionnaire d&apos;évaluation
          </h1>
          <p style={{ color: '#6b7280', fontSize: '13px', margin: 0 }}>
            Optionnel — ajoutez des questions QCM pour évaluer les apprenants à la fin de la formation.
          </p>
        </div>

        <div style={{ ...cardStyle, marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#111827', margin: 0 }}>
              Questions ({questions.length})
            </h2>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <label style={{ fontSize: '13px', color: '#374151' }}>Seuil réussite :</label>
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
                + Question
              </button>
            </div>
          </div>

          {questions.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px', color: '#9ca3af', fontSize: '14px' }}>
              <p style={{ margin: '0 0 8px' }}>Aucune question — la formation sera créée sans questionnaire.</p>
              <p style={{ margin: 0, fontSize: '12px' }}>Vous pourrez en ajouter plus tard depuis la page de la formation.</p>
            </div>
          )}

          {questions.map((q, qi) => (
            <div key={qi} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '14px', marginBottom: '10px', background: '#f9fafb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#6b7280' }}>Question {qi + 1}</span>
                <button
                  onClick={() => setQuestions(prev => prev.filter((_, i) => i !== qi))}
                  style={{ background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '4px', padding: '3px 8px', fontSize: '12px', cursor: 'pointer' }}
                >
                  Supprimer
                </button>
              </div>
              <input
                style={{ width: '100%', padding: '8px 12px', border: '1px solid ' + (!q.texte.trim() ? '#ef4444' : '#d1d5db'), borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '8px' }}
                value={q.texte}
                onChange={e => setQuestions(prev => prev.map((q2, i) => i === qi ? { ...q2, texte: e.target.value } : q2))}
                placeholder="Texte de la question... *"
              />
              {!q.texte.trim() && <p style={{ color: '#dc2626', fontSize: '12px', margin: '-4px 0 8px' }}>Le texte est requis</p>}
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
                + Réponse
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
            Annuler
          </button>
          <button onClick={() => setShowPreview(true)} style={btnPrimaryStyle}>
            ✓ Créer la formation
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
      <div style={{ maxWidth: '600px', margin: '40px auto', padding: '32px', background: '#fff', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.1)', fontFamily: 'system-ui, sans-serif' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', margin: '0 0 4px' }}>Aperçu avant création</h2>
        <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 24px' }}>Vérifiez le récapitulatif avant de soumettre.</p>
        <div style={{ display: 'grid', gap: '14px', marginBottom: '24px' }}>
          <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><span style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase' }}>Titre</span><p style={{ fontSize: '15px', fontWeight: '600', color: '#111827', margin: '4px 0 0' }}>{titre}</p></div>
              <div><span style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase' }}>Niveau</span><p style={{ fontSize: '14px', color: '#374151', margin: '4px 0 0', textTransform: 'capitalize' }}>{niveau}</p></div>
              <div><span style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase' }}>Modules</span><p style={{ fontSize: '14px', color: '#374151', margin: '4px 0 0' }}>{modules.length} module{modules.length > 1 ? 's' : ''}</p></div>
              <div><span style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase' }}>Leçons</span><p style={{ fontSize: '14px', color: '#374151', margin: '4px 0 0' }}>{totalLecons} leçon{totalLecons > 1 ? 's' : ''}</p></div>
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
          <button onClick={handleSubmit} style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 2px 8px rgba(124,58,237,0.35)' }}>✓ Confirmer et créer</button>
        </div>
      </div>
    )
  }

  // STEP: Creating
  if (step === 'creating') {
    return (
      <div style={{ ...containerStyle, textAlign: 'center', paddingTop: '80px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
        <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#111827' }}>Création en cours...</h2>
        <p style={{ color: '#6b7280' }}>La formation et ses modules sont en cours de création.</p>
      </div>
    )
  }

  // STEP: Done
  return (
    <div style={{ ...containerStyle, textAlign: 'center', paddingTop: '60px' }}>
      <div style={cardStyle}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>✅</div>
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: '0 0 8px' }}>
          Formation créée avec succès!
        </h2>
        <p style={{ color: '#6b7280', marginBottom: '28px' }}>
          La formation <strong>{titre}</strong> a été créée avec {modules.length} module(s).
          Elle est en brouillon — vous pouvez maintenant l&apos;éditer et la publier.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button onClick={() => router.push('/admin/formations/' + formationId)} style={btnPrimaryStyle}>
            Voir la formation
          </button>
          <button onClick={() => router.push('/admin/formations')} style={btnSecondaryStyle}>
            Liste des formations
          </button>
          <button onClick={() => { setStep('upload'); setFileName(''); setModules([]); setTitre(''); setDescription(''); setTags([]); setObjectifs([]); setPrerequisIds([]); setImageCouverture(null) }} style={btnSecondaryStyle}>
            Générer une autre
          </button>
        </div>
      </div>
    </div>
  )
}
