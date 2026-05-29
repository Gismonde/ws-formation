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
  obligatoire: boolean
}

export default function PreuvesPage() {
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

    // Load formations via server API (bypasses RLS)
    const resFormations = await fetch('/api/mes-formations')
    if (resFormations.ok) {
      const data = await resFormations.json()
      setFormations(data.formations ?? [])
    }

    // Load existing proofs
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
    if (!autreMode && !selectedFormationId) return
    if (autreMode && !autreTitre.trim()) return

    setUploading(true)
    setMessage(null)

    const formData = new FormData()
    formData.append('file', selectedFile)
    if (autreMode) {
      formData.append('formation_id', 'autre')
      formData.append('formation_titre_autre', autreTitre.trim())
    } else {
      formData.append('formation_id', selectedFormationId)
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

  function statutBadge(statut: StatutPreuve) {
    const cfg = {
      en_attente: { bg: '#fef3c7', color: '#92400e', label: 'En attente' },
      validee: { bg: '#d1fae5', color: '#065f46', label: 'Validee' },
      refusee: { bg: '#fee2e2', color: '#991b1b', label: 'Refusee' },
    }
    const c = cfg[statut] || cfg.en_attente
    return (
      <span style={{ background: c.bg, color: c.color, padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>
        {c.label}
      </span>
    )
  }

  function getFormationTitle(preuve: Preuve): string {
    if (preuve.nom_fichier && preuve.nom_fichier.startsWith('[AUTRE: ')) {
      const match = preuve.nom_fichier.match(/^\[AUTRE: (.+?)\]/)
      if (match) return match[1] + ' (Autre)'
    }
    return preuve.formations?.titre ?? preuve.formation_id ?? 'Formation inconnue'
  }

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

      {/* Upload form */}
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
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', background: '#fff', color: '#1a1f36' }}
            >
              <option value="">-- Choisir une formation --</option>
              {formations.map(f => (
                <option key={f.id} value={f.id}>
                  {f.titre}{f.obligatoire ? ' (Obligatoire)' : ''}
                </option>
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
                placeholder="Indiquez le nom de la formation..."
                required
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', color: '#1a1f36', boxSizing: 'border-box' }}
              />
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
              Document justificatif * (PDF, JPG, PNG - max 10MB)
            </label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={e => setSelectedFile(e.target.files?.[0] || null)}
              required
              style={{ display: 'block', width: '100%', padding: '10px', border: '2px dashed #d1d5db', borderRadius: '8px', fontSize: '13px', color: '#6b7280', cursor: 'pointer', background: '#f9fafb' }}
            />
            {selectedFile && (
              <p style={{ fontSize: '12px', color: '#6366f1', marginTop: '6px' }}>
                Fichier : {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)
              </p>
            )}
          </div>

          {message && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '16px',
              background: message.type === 'success' ? '#d1fae5' : '#fee2e2',
              color: message.type === 'success' ? '#065f46' : '#991b1b',
              fontSize: '14px',
            }}>
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={uploading}
            style={{
              padding: '10px 24px',
              background: uploading ? '#9ca3af' : '#6366f1',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: uploading ? 'not-allowed' : 'pointer',
            }}
          >
            {uploading ? 'Envoi en cours...' : 'Envoyer la preuve'}
          </button>
        </form>
      </div>

      {/* Existing proofs list */}
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#1a1f36', marginBottom: '16px' }}>Mes preuves soumises</h2>
        {preuves.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
            Aucune preuve soumise pour le moment.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {preuves.map((p) => (
              <div key={p.id} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <div>
                  <p style={{ fontWeight: '600', color: '#1a1f36', margin: 0, fontSize: '14px' }}>
                    {getFormationTitle(p)}
                  </p>
                  <p style={{ color: '#6b7280', fontSize: '12px', margin: '4px 0 0' }}>
                    {new Date(p.created_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                  {p.commentaire_admin && (
                    <p style={{ color: '#6b7280', fontSize: '12px', margin: '4px 0 0', fontStyle: 'italic' }}>
                      Note : {p.commentaire_admin}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                  {statutBadge(p.statut)}
                  <a
                    href={p.fichier_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '12px', color: '#6366f1', textDecoration: 'none', fontWeight: '500' }}
                  >
                    Voir le fichier
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
