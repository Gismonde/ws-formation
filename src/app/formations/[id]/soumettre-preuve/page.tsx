'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

export default function SoumettrePreuvePage() {
  const params = useParams()
  const formationId = params.id as string
  const router = useRouter()

  const [formation, setFormation] = useState<{ titre: string } | null>(null)
  const [existingPreuves, setExistingPreuves] = useState<any[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Load formation title
      const { data: f } = await supabase
        .from('formations')
        .select('titre')
        .eq('id', formationId)
        .single()
      setFormation(f)

      // Load existing proofs
      const res = await fetch(`/api/preuves?formation_id=${formationId}`)
      if (res.ok) {
        const data = await res.json()
        setExistingPreuves(data.preuves ?? [])
      }
    }
    load()
  }, [formationId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) { setError('Veuillez sélectionner un fichier'); return }
    setLoading(true)
    setError('')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('formation_id', formationId)

    const res = await fetch('/api/upload-preuve', {
      method: 'POST',
      body: formData,
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? 'Erreur lors de l'upload')
      return
    }

    setSuccess(true)
    setFile(null)
    setExistingPreuves(prev => [data.preuve, ...prev])
  }

  const statutStyle = (statut: string) => {
    if (statut === 'valide') return { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0', label: '✓ Validée' }
    if (statut === 'refuse') return { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', label: '✗ Refusée' }
    return { bg: '#fefce8', color: '#ca8a04', border: '#fde68a', label: '⏳ En attente de validation' }
  }

  return (
    <div style={{ maxWidth: '640px', margin: '40px auto', padding: '0 24px', fontFamily: "'Inter', sans-serif" }}>
      {/* Back link */}
      <Link href={`/formations/${formationId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#6366f1', textDecoration: 'none', fontSize: '14px', fontWeight: '500', marginBottom: '24px' }}>
        ← Retour à la formation
      </Link>

      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: '0 0 6px 0' }}>
          Soumettre une preuve externe
        </h1>
        {formation && (
          <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
            Formation : <strong>{formation.titre}</strong>
          </p>
        )}
        <p style={{ color: '#6b7280', fontSize: '13px', marginTop: '8px', lineHeight: '1.5', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          Vous avez complété cette formation en dehors de la plateforme ? Soumettez un certificat, attestation ou tout autre document justificatif. Un administrateur examinera votre preuve et validera votre formation.
        </p>
      </div>

      {/* Existing proofs */}
      {existingPreuves.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
            Mes soumissions précédentes
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {existingPreuves.map((p: any) => {
              const s = statutStyle(p.statut)
              return (
                <div key={p.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '500', color: '#374151', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      📎 {p.nom_fichier}
                    </div>
                    <div style={{ color: '#9ca3af', fontSize: '12px', marginTop: '4px' }}>
                      Soumis le {new Date(p.soumis_le).toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                    {p.commentaire && (
                      <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '6px', fontStyle: 'italic' }}>
                        Commentaire : {p.commentaire}
                      </div>
                    )}
                  </div>
                  <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '20px', background: s.bg, color: s.color, fontSize: '12px', fontWeight: '600', border: `1px solid ${s.border}`, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {s.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Upload form */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', padding: '28px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <h2 style={{ fontSize: '15px', fontWeight: '600', color: '#374151', margin: '0 0 20px 0' }}>
          Nouvelle soumission
        </h2>

        {success && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: '#16a34a', fontSize: '14px', fontWeight: '500' }}>
            ✅ Votre preuve a été soumise avec succès ! Un administrateur la examinera prochainement.
          </div>
        )}

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: '#dc2626', fontSize: '14px' }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* File upload area */}
          <div
            style={{ border: '2px dashed #d1d5db', borderRadius: '10px', padding: '32px', textAlign: 'center', marginBottom: '20px', background: file ? '#f0fdf4' : '#fafafa', transition: 'all 0.2s', cursor: 'pointer', borderColor: file ? '#16a34a' : '#d1d5db' }}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) { setFile(f); setSuccess(false) }
              }}
            />
            {file ? (
              <div>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>📄</div>
                <div style={{ fontWeight: '600', color: '#16a34a', fontSize: '14px' }}>{file.name}</div>
                <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px' }}>
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </div>
                <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null) }} style={{ marginTop: '8px', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}>
                  Changer de fichier
                </button>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>📂</div>
                <div style={{ fontWeight: '500', color: '#374151', fontSize: '14px' }}>Cliquez pour sélectionner un fichier</div>
                <div style={{ color: '#9ca3af', fontSize: '12px', marginTop: '6px' }}>PDF, JPG, PNG — Maximum 10 MB</div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={!file || loading}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              background: !file || loading ? '#e5e7eb' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: !file || loading ? '#9ca3af' : '#fff',
              border: 'none',
              fontSize: '15px',
              fontWeight: '600',
              cursor: !file || loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {loading ? 'Envoi en cours...' : 'Soumettre pour validation'}
          </button>
        </form>
      </div>
    </div>
  )
}
