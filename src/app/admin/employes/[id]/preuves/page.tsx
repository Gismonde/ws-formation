'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AdminPreuvesPage() {
  const params = useParams()
  const employeId = params.id as string
  const router = useRouter()

  const [employe, setEmploye] = useState<any>(null)
  const [preuves, setPreuves] = useState<any[]>([])
  const [formations, setFormations] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [commentaires, setCommentaires] = useState<Record<string, string>>({})

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Load employee info
      const empRes = await fetch(`/api/admin/assigner-formation-data`)
      const empData = await empRes.json()

      // Get this specific employee
      const allEmployes = empData.employes ?? []
      const emp = allEmployes.find((e: any) => e.id === employeId)
      setEmploye(emp)

      // Load their preuves
      const preuvesRes = await fetch(`/api/preuves?employe_id=${employeId}`)
      const preuvesData = await preuvesRes.json()
      setPreuves(preuvesData.preuves ?? [])

      // Load formation names
      const { data: formationsData } = await supabase.from('formations').select('id, titre')
      const formMap: Record<string, string> = {}
      formationsData?.forEach((f: any) => { formMap[f.id] = f.titre })
      setFormations(formMap)

      setLoading(false)
    }
    load()
  }, [employeId])

  async function handleDecision(preuveId: string, statut: 'valide' | 'refuse') {
    setActionLoading(preuveId + statut)
    const res = await fetch('/api/admin/valider-preuve', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preuve_id: preuveId,
        statut,
        commentaire: commentaires[preuveId] ?? null,
      }),
    })

    setActionLoading(null)
    if (res.ok) {
      setPreuves(prev => prev.map(p => p.id === preuveId ? { ...p, statut, commentaire: commentaires[preuveId] } : p))
    } else {
      const data = await res.json()
      alert('Erreur: ' + data.error)
    }
  }

  const statutBadge = (statut: string) => {
    if (statut === 'valide') return { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0', label: '✓ Validée' }
    if (statut === 'refuse') return { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', label: '✗ Refusée' }
    return { bg: '#fefce8', color: '#ca8a04', border: '#fde68a', label: '⏳ En attente' }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px' }}>
      <p style={{ color: '#6b7280' }}>Chargement...</p>
    </div>
  )

  const enAttente = preuves.filter(p => p.statut === 'en_attente')
  const traitees = preuves.filter(p => p.statut !== 'en_attente')

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <Link href={`/admin/employes/${employeId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#6366f1', textDecoration: 'none', fontSize: '13px', fontWeight: '500', marginBottom: '8px' }}>
            ← Retour au dossier
          </Link>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>
            Preuves externes
          </h1>
          {employe && (
            <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px', margin: '4px 0 0 0' }}>
              {employe.prenom} {employe.nom} — {preuves.length} soumission(s)
            </p>
          )}
        </div>
        {enAttente.length > 0 && (
          <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: '8px', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#ca8a04', fontSize: '13px', fontWeight: '600' }}>
              ⏳ {enAttente.length} en attente de validation
            </span>
          </div>
        )}
      </div>

      {preuves.length === 0 && (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', padding: '48px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>📂</div>
          <p style={{ color: '#6b7280', margin: 0 }}>Aucune preuve soumise par cet employé</p>
        </div>
      )}

      {/* Pending proofs */}
      {enAttente.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
            En attente de validation ({enAttente.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {enAttente.map((p: any) => (
              <div key={p.id} style={{ background: '#fff', borderRadius: '14px', border: '1px solid #fde68a', padding: '20px', boxShadow: '0 2px 8px rgba(253,230,138,0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ background: '#f0f0ff', color: '#6366f1', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>
                        {formations[p.formation_id] ?? 'Formation inconnue'}
                      </span>
                    </div>
                    <div style={{ fontWeight: '600', color: '#111827', fontSize: '14px', marginBottom: '2px' }}>
                      📎 {p.nom_fichier}
                    </div>
                    <div style={{ color: '#9ca3af', fontSize: '12px' }}>
                      Soumis le {new Date(p.soumis_le).toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                  </div>
                  <span style={{ ...statutBadge(p.statut), display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', border: `1px solid ${statutBadge(p.statut).border}`, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {statutBadge(p.statut).label}
                  </span>
                </div>

                {/* Comment field */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#6b7280', marginBottom: '6px' }}>
                    Commentaire (optionnel)
                  </label>
                  <input
                    type="text"
                    placeholder="Ajouter un commentaire pour l'employé..."
                    value={commentaires[p.id] ?? ''}
                    onChange={e => setCommentaires(prev => ({ ...prev, [p.id]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '13px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => handleDecision(p.id, 'valide')}
                    disabled={actionLoading === p.id + 'valide'}
                    style={{ flex: 1, padding: '9px', borderRadius: '8px', background: actionLoading === p.id + 'valide' ? '#e5e7eb' : 'linear-gradient(135deg, #16a34a, #15803d)', color: actionLoading === p.id + 'valide' ? '#9ca3af' : '#fff', border: 'none', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    ✓ Valider la formation
                  </button>
                  <button
                    onClick={() => handleDecision(p.id, 'refuse')}
                    disabled={actionLoading === p.id + 'refuse'}
                    style={{ flex: 1, padding: '9px', borderRadius: '8px', background: actionLoading === p.id + 'refuse' ? '#e5e7eb' : '#fef2f2', color: actionLoading === p.id + 'refuse' ? '#9ca3af' : '#dc2626', border: '1px solid #fecaca', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    ✗ Refuser
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Processed proofs */}
      {traitees.length > 0 && (
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: '600', color: '#6b7280', marginBottom: '12px' }}>
            Déjà traitées ({traitees.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {traitees.map((p: any) => {
              const s = statutBadge(p.statut)
              return (
                <div key={p.id} style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', opacity: 0.8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ background: '#f0f0ff', color: '#6366f1', padding: '1px 7px', borderRadius: '5px', fontSize: '11px', fontWeight: '600' }}>
                        {formations[p.formation_id] ?? '...'}
                      </span>
                      <span style={{ fontWeight: '500', color: '#374151', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.nom_fichier}
                      </span>
                    </div>
                    {p.commentaire && (
                      <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px', fontStyle: 'italic' }}>
                        {p.commentaire}
                      </div>
                    )}
                  </div>
                  <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '20px', background: s.bg, color: s.color, fontSize: '11px', fontWeight: '600', border: `1px solid ${s.border}`, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {s.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
