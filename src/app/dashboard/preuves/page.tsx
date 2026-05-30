'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type StatutPreuve = 'en_attente' | 'validee' | 'refusee'

type Preuve = {
  id: string
  formation_id: string | null
  nom_fichier: string
  fichier_url: string
  statut: StatutPreuve
  commentaire_admin: string | null
  created_at: string
  formations?: { titre: string }
}

type Formation = {
  id: string
  titre: string
  obligatoire?: boolean
}

export default function MesPreuvesPage() {
  const [formations, setFormations] = useState<Formation[]>([])
  const [preuves, setPreuves] = useState<Preuve[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedFormationId, setSelectedFormationId] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [autreMode, setAutreMode] = useState(false)
  const [autreTitre, setAutreTitre] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)

    const resFormations = await fetch('/api/mes-formations')
    if (resFormations.ok) {
      const data = await resFormations.json()
      setFormations(data.formations ?? [])
    }

    const resPreuves = await fetch('/api/preuves')
    if (resPreuves.ok) {
      const data = await resPreuves.json()
      setPreuves(data.preuves ?? [])
    }

    setLoading(false)
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedFile) return
    setUploading(true)
    setMessage(null)

    const formData = new FormData()
    formData.append('fichier', selectedFile)
    formData.append('formation_id', selectedFormationId === 'autre' ? '' : selectedFormationId)
    if (selectedFormationId === 'autre' && autreTitre.trim()) {
      formData.append('formation_titre_autre', autreTitre.trim())
    }

    const res = await fetch('/api/upload-preuve', { method: 'POST', body: formData })
    const data = await res.json()

    if (res.ok && data.success) {
      setMessage({ type: 'success', text: 'Preuve envoyee ! Un administrateur va la valider.' })
      setSelectedFile(null)
      setSelectedFormationId('')
      setAutreMode(false)
      setAutreTitre('')
      await loadData()
    } else {
      setMessage({ type: 'error', text: data.error || 'Erreur lors de l upload' })
    }
    setUploading(false)
  }

  function handleFormationChange(val: string) {
    if (val === 'autre') {
      setAutreMode(true)
      setSelectedFormationId('autre')
    } else {
      setAutreMode(false)
      setSelectedFormationId(val)
    }
  }

  function getFormationTitle(p: Preuve): string {
    if (p.formations?.titre) return p.formations.titre
    return 'Formation inconnue'
  }

  function getStatutLabel(s: StatutPreuve) {
    if (s === 'en_attente') return { label: 'En attente', bg: '#fef3c7', color: '#92400e' }
    if (s === 'validee') return { label: 'Validee', bg: '#d1fae5', color: '#065f46' }
    return { label: 'Refusee', bg: '#fee2e2', color: '#991b1b' }
  }

  const formationsObligatoires = formations.filter(f => f.obligatoire)
  const formationsOptionnelles = formations.filter(f => !f.obligatoire)

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
        <div style={{ textAlign: 'center', color: '#6b7280' }}>Chargement...</div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1a1f36', margin: 0 }}>Mes preuves de formation</h1>
        <p style={{ color: '#6b7280', marginTop: '4px', fontSize: '14px' }}>
          Uploadez un document (attestation, certificat) pour faire valider une formation par votre responsable.
        </p>
      </div>

      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '24px', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#1a1f36', marginTop: 0, marginBottom: '20px' }}>
          Soumettre une preuve
        </h2>
        <form onSubmit={handleUpload}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
              Formation concernee *
            </label>
            <select
              value={selectedFormationId}
              onChange={e => handleFormationChange(e.target.value)}
              required
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', background: '#fff' }}
            >
              <option value="">-- Choisir une formation --</option>
              {formationsObligatoires.length > 0 && (
                <optgroup label="Obligatoires (LSST)">
                  {formationsObligatoires.map(f => (
                    <option key={f.id} value={f.id}>{f.titre}</option>
                  ))}
                </optgroup>
              )}
              {formationsOptionnelles.length > 0 && (
                <optgroup label="Autres formations">
                  {formationsOptionnelles.map(f => (
                    <option key={f.id} value={f.id}>{f.titre}</option>
                  ))}
                </optgroup>
              )}
              {formationsObligatoires.length === 0 && formationsOptionnelles.length === 0 && formations.map(f => (
                <option key={f.id} value={f.id}>{f.titre}</option>
              ))}
              <option value="autre">-- Autre (preciser) --</option>
            </select>
          </div>

          {autreMode && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                Nom de la formation *
              </label>
              <input
                type="text"
                value={autreTitre}
                onChange={e => setAutreTitre(e.target.value)}
                placeholder="Ex: Formation premiers secours"
                required
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', background: '#fff', boxSizing: 'border-box' }}
              />
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
              Document (PDF, JPG, PNG) *
            </label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
              required
              style={{ display: 'block', width: '100%' }}
            />
          </div>

          {message && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '16px',
              background: message.type === 'success' ? '#d1fae5' : '#fee2e2',
              color: message.type === 'success' ? '#065f46' : '#991b1b',
            }}>
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={uploading}
            style={{
              background: uploading ? '#9ca3af' : '#4f46e5',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: uploading ? 'not-allowed' : 'pointer',
            }}
          >
            {uploading ? 'Envoi en cours...' : 'Soumettre la preuve'}
          </button>
        </form>
      </div>

      <div>
        <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#1a1f36', marginBottom: '16px' }}>Mes preuves soumises</h2>
        {preuves.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '40px', textAlign: 'center', color: '#6b7280' }}>
            Aucune preuve soumise pour le moment.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {preuves.map(p => (
              <div key={p.id} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontWeight: '600', color: '#1a1f36', margin: 0, fontSize: '14px' }}>
                    {getFormationTitle(p)}
                  </p>
                  <p style={{ color: '#6b7280', margin: '4px 0 0', fontSize: '13px' }}>
                    {new Date(p.created_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                  {p.commentaire_admin && (
                    <p style={{ color: '#374151', margin: '8px 0 0', fontSize: '13px', fontStyle: 'italic' }}>
                      Commentaire : {p.commentaire_admin}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '600',
                    background: getStatutLabel(p.statut).bg,
                    color: getStatutLabel(p.statut).color,
                  }}>
                    {getStatutLabel(p.statut).label}
                  </span>
                  <a
                    href={p.fichier_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '12px', color: '#6366f1', textDecoration: 'none' }}
                  >
                    Voir le document
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
