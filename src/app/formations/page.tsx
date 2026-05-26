'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'

type Formation = {
  id: string
  titre: string
  description: string | null
  duree_estimee: number | null
  niveau: string | null
  actif: boolean
  created_at: string
  modules?: { count: number }[]
}

type Assignation = { formation_id: string; statut: string; progression: number }

export default function FormationsPage() {
  const [formations, setFormations] = useState<Formation[]>([])
  const [assignations, setAssignations] = useState<Assignation[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatut, setFilterStatut] = useState<'toutes' | 'assignees' | 'en_cours' | 'completes'>('toutes')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: fms }, { data: emp }] = await Promise.all([
        supabase.from('formations').select('*, modules(count)').eq('actif', true).order('created_at', { ascending: false }),
        supabase.from('employes').select('id').eq('auth_user_id', user.id).single()
      ])

      if (emp) {
        const { data: assigns } = await supabase.from('assignations')
          .select('formation_id, statut, progression').eq('employe_id', emp.id)
        setAssignations(assigns || [])
      }

      setFormations(fms || [])
      setLoading(false)
    }
    load()
  }, [])

  const getAssignation = (formationId: string) => assignations.find(a => a.formation_id === formationId)

  const filteredFormations = formations.filter(f => {
    if (filterStatut === 'toutes') return true
    const a = getAssignation(f.id)
    if (filterStatut === 'assignees') return !!a && a.statut === 'assignee'
    if (filterStatut === 'en_cours') return !!a && a.statut === 'en_cours'
    if (filterStatut === 'completes') return !!a && a.statut === 'complete'
    return true
  })

  const statusBadge = (formationId: string) => {
    const a = getAssignation(formationId)
    if (!a) return <span style={{ fontSize: 12, color: '#9ca3af', backgroundColor: '#f3f4f6', padding: '3px 8px', borderRadius: 9999 }}>Disponible</span>
    const configs: Record<string, { color: string; bg: string; label: string }> = {
      assignee: { color: '#1d4ed8', bg: '#dbeafe', label: '📋 Assignée' },
      en_cours: { color: '#92400e', bg: '#fef3c7', label: '▶️ En cours' },
      complete: { color: '#166534', bg: '#dcfce7', label: '✅ Complétée' }
    }
    const c = configs[a.statut] || { color: '#6b7280', bg: '#f3f4f6', label: a.statut }
    return <span style={{ fontSize: 12, color: c.color, backgroundColor: c.bg, padding: '3px 8px', borderRadius: 9999, fontWeight: 600 }}>{c.label}</span>
  }

  const niveauColor = (niveau: string | null) => {
    const colors: Record<string, string> = { debutant: '#16a34a', intermediaire: '#d97706', avance: '#dc2626' }
    return colors[niveau || ''] || '#6b7280'
  }

  if (loading) return <div style={{ padding: 40, fontFamily: 'sans-serif', textAlign: 'center' }}>Chargement des formations...</div>

  return (
    <div style={{ fontFamily: 'sans-serif', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      {/* Header */}
      <div style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', padding: '20px 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>📚 Mes formations</h1>
            <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>{filteredFormations.length} formation{filteredFormations.length !== 1 ? 's' : ''}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { key: 'toutes', label: 'Toutes' },
              { key: 'assignees', label: 'Assignées' },
              { key: 'en_cours', label: 'En cours' },
              { key: 'completes', label: 'Complétées' }
            ].map(f => (
              <button key={f.key} onClick={() => setFilterStatut(f.key as any)}
                style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid', borderColor: filterStatut === f.key ? '#1e40af' : '#d1d5db', backgroundColor: filterStatut === f.key ? '#1e40af' : 'white', color: filterStatut === f.key ? 'white' : '#374151', cursor: 'pointer', fontSize: 13, fontWeight: filterStatut === f.key ? 600 : 400 }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 32px' }}>
        {filteredFormations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
            <p>Aucune formation dans cette catégorie</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {filteredFormations.map(f => {
              const assignation = getAssignation(f.id)
              const progression = assignation?.progression || 0
              return (
                <div key={f.id} style={{ backgroundColor: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'box-shadow 0.2s' }}>
                  {/* Color band based on niveau */}
                  <div style={{ height: 6, backgroundColor: niveauColor(f.niveau) }} />
                  
                  <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      {statusBadge(f.id)}
                      {f.niveau && <span style={{ fontSize: 11, color: niveauColor(f.niveau), fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.niveau}</span>}
                    </div>

                    <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#111827', lineHeight: 1.3 }}>{f.titre}</h3>
                    {f.description && <p style={{ margin: '0 0 12px', fontSize: 14, color: '#6b7280', lineHeight: 1.5, flex: 1 }}>{f.description.substring(0, 100)}{f.description.length > 100 ? '...' : ''}</p>}

                    {/* Meta info */}
                    <div style={{ display: 'flex', gap: 12, marginBottom: 14, fontSize: 12, color: '#9ca3af' }}>
                      {f.duree_estimee && <span>⏱ {f.duree_estimee} min</span>}
                      {f.modules && f.modules[0] && <span>📖 {(f.modules[0] as any).count} module{(f.modules[0] as any).count !== 1 ? 's' : ''}</span>}
                    </div>

                    {/* Progress bar if in progress */}
                    {assignation && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: '#6b7280' }}>
                          <span>Progression</span><span>{progression}%</span>
                        </div>
                        <div style={{ height: 6, backgroundColor: '#e5e7eb', borderRadius: 9999, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: progression + '%', backgroundColor: progression === 100 ? '#16a34a' : '#1e40af', borderRadius: 9999, transition: 'width 0.3s' }} />
                        </div>
                      </div>
                    )}

                    <Link href={'/formations/' + f.id} style={{ display: 'block', textAlign: 'center', padding: '9px 16px', backgroundColor: assignation?.statut === 'complete' ? '#f0fdf4' : '#1e40af', color: assignation?.statut === 'complete' ? '#16a34a' : 'white', borderRadius: 6, textDecoration: 'none', fontSize: 14, fontWeight: 600, border: assignation?.statut === 'complete' ? '1px solid #86efac' : 'none' }}>
                      {assignation?.statut === 'complete' ? '✅ Revoir la formation' : assignation ? '▶️ Continuer' : '👁 Voir la formation'}
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
