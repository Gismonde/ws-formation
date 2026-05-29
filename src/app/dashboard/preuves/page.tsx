'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type StatutPreuve = 'en_attente' | 'validee' | 'refusee'

type Preuve = {
  id: string
  formation_id: string
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
  const [employeId, setEmployeId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Get employe
    const { data: employe } = await supabase
      .from('employes')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!employe) return
    setEmployeId(employe.id)

    // Get assigned formations
    const { data: assignations } = await supabase
      .from('assignations')
      .select('formation_id')
      .eq('employe_id', employe.id)

    const ids = assignations?.map((a: any) => a.formation_id) ?? []

    if (ids.length > 0) {
      const { data: formationsData } = await supabase
        .from('formations')
        .select('id, titre, obligatoire')
        .in('id', ids)
        .eq('publiee', true)
      setFormations(formationsData ?? [])
    }

    // Get existing proofs
    const res = await fetch('/api/preuves')
    if (res.ok) {
      const data = await res.json()
      setPreuves(data.preuves ?? [])
    }

    setLoading(false)
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedFile || !selectedFormationId) return

    setUploading(true)
    setMessage(null)

    const formData = new FormData()
    formData.append('file', selectedFile)
    formData.append('formation_id', selectedFormationId)

    const res = await fetch('/api/upload-preuve', { method: 'POST', body: formData })
    const data = await res.json()

    if (res.ok && data.success) {
      setMessage({ type: 'success', text: 'Preuve envoyee ! Un administrateur va la valider.' })
      setSelectedFile(null)
      setSelectedFormationId('')
      await loadData()
    } else {
      setMessage({ type: 'error', text: data.error || 'Erreur lors de l upload' })
    }
    setUploading(false)
  }

  function statutBadge(statut: StatutPreuve) {
    const cfg = {
      en_attente: { bg: '#fef3c7', color: '#92400e', label: '⏳ En attente' },
      validee: { bg: '#d1fae5', color: '#065f46', label: '✅ Validee' },
      refusee: { bg: '#fee2e2', color: '#991b1b', label: '❌ Refusee' },
    }
    const c = cfg[statut] || cfg.en_attente
    return (
      <span style={{ background: c.bg, color: c.color, padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>
        {c.label}
      </span>
    )
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
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1a1f36', margin: 0 }}>📎 Mes preuves de formation</h1>
        <p style={{ color: '#6b7280', marginTop: '4px', fontSize: '14px' }}>
          Uploadez un document (attestation, certificat) pour faire valider une formation obligatoire par votre responsable.
        </p>
      </div>

      {/* Upload form */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '24px', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#1a1f36', marginBottom: '16px' }}>
          Soumettre une preuve
        </h2>
        <form onSubmit={handleUpload}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
              Formation concernee *
            </label>
            <select
              value={selectedFormationId}
              onChange={e => setSelectedFormationId(e.target.value)}
              required
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', background: '#fff', color: '#1a1f36' }}
            >
              <option value="">-- Choisir une formation --</option>
              {formations.map(f => (
                <option key={f.id} value={f.id}>
                  {f.titre}{f.obligatoire ? ' (Obligatoire)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
              Document justificatif * (PDF, JPG, PNG — max 10MB)
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
                ✓ {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)
              </p>
            )}
          </div>

          {message && (
            <div style={{
              padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px',
              background: message.type === 'success' ? '#d1fae5' : '#fee2e2',
              color: message.type === 'success' ? '#065f46' : '#991b1b'
            }}>
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={uploading || !selectedFile || !selectedFormationId}
            style={{
              padding: '10px 24px', background: uploading ? '#9ca3af' : '#6366f1',
              color: '#fff', borderRadius: '8px', border: 'none', fontSize: '14px',
              fontWeight: '600', cursor: uploading ? 'not-allowed' : 'pointer'
            }}
          >
            {uploading ? 'Envoi en cours...' : '📤 Soumettre ma preuve'}
          </button>
        </form>
      </div>

      {/* List of existing proofs */}
      <div>
        <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#1a1f36', marginBottom: '16px' }}>
          Mes demandes ({preuves.length})
        </h2>

        {preuves.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '48px', textAlign: 'center' }}>
            <p style={{ fontSize: '32px', marginBottom: '8px' }}>📭</p>
            <p style={{ color: '#6b7280', fontSize: '14px' }}>Aucune preuve soumise pour le moment.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {preuves.map((p: Preuve) => (
              <div key={p.id} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: '600', fontSize: '14px', color: '#1a1f36', margin: '0 0 4px' }}>
                    {p.formations?.titre || 'Formation'}
                  </p>
                  <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>
                    Soumis le {new Date(p.created_at).toLocaleDateString('fr-FR')}
                  </p>
                  {p.commentaire_admin && (
                    <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', fontStyle: 'italic' }}>
                      💬 {p.commentaire_admin}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {statutBadge(p.statut)}
                  <a href={p.fichier_url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: '12px', color: '#6366f1', textDecoration: 'none' }}>
                    Voir le fichier →
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
