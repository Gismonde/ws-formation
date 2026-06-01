'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

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

interface ModuleData {
  titre: string
  contenu: string
  duree_minutes: number
  lecons: LeconData[]
}

function parseDocumentIntoModules(text: string): { titre: string; description: string; modules: ModuleData[] } {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)

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
        titre: chunkLines[0].substring(0, 80) || `Section ${i + 1}`,
        contenu: chunkLines.slice(1).join('\n').substring(0, 1000),
        duree_minutes: 30,
      })
    })
  }

  modules.forEach(m => {
    const wordCount = m.contenu.split(/\s+/).length
    m.duree_minutes = Math.max(15, Math.min(120, Math.round(wordCount / 10) * 5))
  })

  return { titre: docTitle || 'Formation sans titre', description: docDescription, modules }
}

type Step = 'upload' | 'review' | 'creating' | 'done'

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
  const [modules, setModules] = useState<ModuleData[]>([])
  const [error, setError] = useState('')
  const [formationId, setFormationId] = useState('')

  const processFile = useCallback(async (file: File) => {
    if (!file) return
    setFileName(file.name)
    setError('')

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

    if (isPdf) {
      try {
        const arrayBuffer = await file.arrayBuffer()
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) })
        const pdf = await loadingTask.promise
        let fullText = ''
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const content = await page.getTextContent()
          fullText += content.items
            .map((item: { str?: string }) => item.str ?? '')
            .join(' ') + '\n'
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
    setModules(prev => [...prev, { titre: `Module ${prev.length + 1}`, contenu: '', duree_minutes: 30 }])
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
    if (!titre.trim()) { setError('Le titre de la formation est requis.'); return }
    if (modules.length === 0) { setError('Au moins un module est requis.'); return }
    if (modules.some(m => !m.titre.trim())) { setError('Chaque module doit avoir un titre.'); return }

    setStep('creating')
    setError('')

    try {
      const res = await fetch('/api/generer-formation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titre, description, categorie, niveau, duree_heures: dureeHeures, modules }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erreur lors de la création.')
        setStep('review')
        return
      }
      setFormationId(data.formation_id)
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
              border: `2px dashed ${dragging ? '#2563eb' : '#d1d5db'}`,
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
                style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Description courte de la formation..."
              />
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
                <label style={labelStyle}>Durée (heures)</label>
                <input
                  style={inputStyle}
                  type="number"
                  min={1}
                  max={40}
                  value={dureeHeures}
                  onChange={e => setDureeHeures(Number(e.target.value))}
                />
              </div>
            </div>
          </div>
        </div>

        <div style={{ ...cardStyle, marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#111827', margin: 0 }}>
              Modules ({modules.length})
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
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#6b7280' }}>Module {idx + 1}</span>
                <button onClick={() => removeModule(idx)} style={btnDangerStyle}>
                  Supprimer
                </button>
              </div>
              <div style={{ display: 'grid', gap: '10px' }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: '13px' }}>Titre *</label>
                  <input
                    style={inputStyle}
                    value={mod.titre}
                    onChange={e => updateModule(idx, 'titre', e.target.value)}
                    placeholder="Titre du module"
                  />
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
                  <label style={{ ...labelStyle, fontSize: '13px' }}>Durée (minutes)</label>
                  <input
                    style={inputStyle}
                    type="number"
                    min={5}
                    max={480}
                    value={mod.duree_minutes}
                    onChange={e => updateModule(idx, 'duree_minutes', Number(e.target.value))}
                  />
                </div>
                {/* Leçons du module */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ ...labelStyle, fontSize: '13px' }}>Leçons</label>
                    <button
                      onClick={() => {
                        const updated = [...modules]
                        updated[idx] = { ...updated[idx], lecons: [...(updated[idx].lecons || []), { titre: '', description: '', image_url: undefined }] }
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
                  {(mod.lecons || []).map((lecon, leconIdx) => (
                    <div key={leconIdx} style={{ border: '1px solid #d1d5db', borderRadius: '6px', padding: '10px', marginBottom: '8px', background: '#fff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Leçon {leconIdx + 1}</span>
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
                        style={{ ...inputStyle, marginBottom: '6px', fontSize: '13px' }}
                        value={lecon.titre}
                        onChange={e => {
                          const updated = [...modules]
                          updated[idx].lecons[leconIdx] = { ...updated[idx].lecons[leconIdx], titre: e.target.value }
                          setModules(updated)
                        }}
                        placeholder="Titre de la leçon"
                      />
                      <textarea
                        style={{ ...inputStyle, minHeight: '70px', resize: 'vertical', fontSize: '13px' }}
                        value={lecon.description}
                        onChange={e => {
                          const updated = [...modules]
                          updated[idx].lecons[leconIdx] = { ...updated[idx].lecons[leconIdx], description: e.target.value }
                          setModules(updated)
                        }}
                        placeholder="Contenu de la leçon..."
                      />
                    </div>
                    {/* Image de la leçon */}
                    <div>
                      <label style={{ ...labelStyle, fontSize: '13px' }}>Image (optionnel)</label>
                      {lecon.image_url ? (
                        <div style={{ position: 'relative', display: 'inline-block', marginBottom: '6px' }}>
                          <img src={lecon.image_url} alt="Aperçu" style={{ maxWidth: '100%', maxHeight: '120px', borderRadius: '4px', border: '1px solid #d1d5db' }} />
                          <button
                            onClick={() => {
                              const updated = [...modules]
                              updated[idx].lecons[leconIdx] = { ...updated[idx].lecons[leconIdx], image_url: undefined }
                              setModules(updated)
                            }}
                            style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '4px', padding: '2px 6px', fontSize: '11px', cursor: 'pointer' }}
                          >
                            ✕ Retirer
                          </button>
                        </div>
                      ) : (
                        <div>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/gif,image/webp"
                            id={`img-lecon-${idx}-${leconIdx}`}
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleLeconImageUpload(file, idx, leconIdx)
                            }}
                          />
                          <label
                            htmlFor={`img-lecon-${idx}-${leconIdx}`}
                            style={{ ...btnSecondaryStyle, display: 'inline-block', cursor: 'pointer', fontSize: '12px', padding: '4px 10px' }}
                          >
                            📷 Ajouter une image
                          </label>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button onClick={() => setStep('upload')} style={btnSecondaryStyle}>
            Annuler
          </button>
          <button onClick={handleSubmit} style={btnPrimaryStyle}>
            ✓ Créer la formation
          </button>
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
          <button onClick={() => router.push(`/admin/formations/${formationId}`)} style={btnPrimaryStyle}>
            Voir la formation
          </button>
          <button onClick={() => router.push('/admin/formations')} style={btnSecondaryStyle}>
            Liste des formations
          </button>
          <button onClick={() => { setStep('upload'); setFileName(''); setModules([]); setTitre(''); setDescription('') }} style={btnSecondaryStyle}>
            Générer une autre
          </button>
        </div>
      </div>
    </div>
  )
}
