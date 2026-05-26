'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

type Formation = {
  id: string; titre: string; description: string | null
  duree_estimee: number | null; niveau: string | null; actif: boolean
}
type Module = {
  id: string; titre: string; contenu: string | null
  ordre: number; duree: number | null; type_contenu: string | null
}
type Assignation = { id: string; statut: string; progression: number; employe_id: string }

export default function FormationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [formation, setFormation] = useState<Formation | null>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [assignation, setAssignation] = useState<Assignation | null>(null)
  const [employeId, setEmployeId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [activeModule, setActiveModule] = useState<Module | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const [{ data: fm }, { data: mods }, { data: emp }] = await Promise.all([
        supabase.from('formations').select('*').eq('id', id).single(),
        supabase.from('modules').select('*').eq('formation_id', id).order('ordre'),
        supabase.from('employes').select('id, role').eq('auth_user_id', user.id).single()
      ])

      setFormation(fm)
      setModules(mods || [])

      if (emp) {
        setEmployeId(emp.id)
        setIsAdmin(['admin','gestionnaire'].includes(emp.role))
        const { data: assign } = await supabase.from('assignations')
          .select('*').eq('formation_id', id).eq('employe_id', emp.id).single()
        setAssignation(assign)
      }
      if (mods && mods.length > 0) setActiveModule(mods[0])
      setLoading(false)
    }
    load()
  }, [id])

  async function startFormation() {
    if (!employeId) return
    const { data } = await supabase.from('assignations').insert({
      formation_id: id, employe_id: employeId, statut: 'en_cours', progression: 0
    }).select().single()
    setAssignation(data)
  }

  async function markModuleComplete(moduleId: string) {
    if (!assignation || !employeId) return
    await supabase.from('progressions').upsert({ assignation_id: assignation.id, module_id: moduleId, complete: true, date_completion: new Date().toISOString() })
    // Recalculate progression
    const { data: progs } = await supabase.from('progressions').select('module_id').eq('assignation_id', assignation.id).eq('complete', true)
    const pct = modules.length > 0 ? Math.round(((progs?.length || 0) / modules.length) * 100) : 0
    const statut = pct === 100 ? 'complete' : 'en_cours'
    await supabase.from('assignations').update({ progression: pct, statut }).eq('id', assignation.id)
    setAssignation(prev => prev ? { ...prev, progression: pct, statut } : null)
    // Move to next module
    const currentIdx = modules.findIndex(m => m.id === moduleId)
    if (currentIdx < modules.length - 1) setActiveModule(modules[currentIdx + 1])
  }

  const niveauLabel: Record<string, string> = { debutant: 'ð¢ Debutant', intermediaire: 'ð¡ Intermediaire', avance: 'ð´ Avance' }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'sans-serif' }}>Chargement...</div>
  if (!formation) return <div style={{ padding: 40, fontFamily: 'sans-serif' }}>Formation introuvable</div>

  return (
    <div style={{ fontFamily: 'sans-serif', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      {/* Top bar */}
      <div style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href={isAdmin ? '/admin/formations' : '/formations'} style={{ color: '#6b7280', textDecoration: 'none', fontSize: 14 }}>
          â {isAdmin ? 'Admin formations' : 'Mes formations'}
        </Link>
        <span style={{ color: '#d1d5db' }}>|</span>
        <span style={{ fontSize: 14, color: '#374151', fontWeight: 500 }}>{formation.titre}</span>
        {isAdmin && (
          <>
            <span style={{ color: '#d1d5db' }}>|</span>
            <Link href={'/admin/formations/' + id + '/modifier'} style={{ fontSize: 13, color: '#1e40af', textDecoration: 'none' }}>âï¸ Modifier</Link>
            <span style={{ fontSize: 12, backgroundColor: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 9999, fontWeight: 600 }}>MODE APERAU ADMIN</span>
          </>
        )}
      </div>

      <div style={{ display: 'flex', maxWidth: 1200, margin: '0 auto', padding: 24, gap: 24 }}>
        {/* Sidebar: modules list */}
        <div style={{ width: 280, flexShrink: 0 }}>
          <div style={{ backgroundColor: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid #f3f4f6', backgroundColor: '#1e40af', color: 'white' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Modules</div>
              {assignation && (
                <div style={{ fontSize: 12, opacity: 0.85 }}>
                  Progression : {assignation.progression}%
                  <div style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 9999, marginTop: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: assignation.progression + '%', backgroundColor: 'white', borderRadius: 9999 }} />
                  </div>
                </div>
              )}
            </div>
            {modules.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Aucun module</div>
            ) : modules.map((m, i) => (
              <button key={m.id} onClick={() => setActiveModule(m)}
                style={{ width: '100%', textAlign: 'left', padding: '12px 18px', border: 'none', borderBottom: '1px solid #f3f4f6', backgroundColor: activeModule?.id === m.id ? '#eff6ff' : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: activeModule?.id === m.id ? '#1e40af' : '#e5e7eb', color: activeModule?.id === m.id ? 'white' : '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                <span style={{ fontSize: 13, fontWeight: activeModule?.id === m.id ? 600 : 400, color: activeModule?.id === m.id ? '#1e40af' : '#374151', lineHeight: 1.3 }}>{m.titre}</span>
                {m.duree && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{m.duree}m</span>}
              </button>
            ))}
          </div>

          {/* Formation info */}
          <div style={{ backgroundColor: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: 18, marginTop: 16 }}>
            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Infos</div>
            {formation.niveau && <div style={{ fontSize: 13, marginBottom: 6 }}>{niveauLabel[formation.niveau] || formation.niveau}</div>}
            {formation.duree_estimee && <div style={{ fontSize: 13, color: '#6b7280' }}>â± {formation.duree_estimee} min estimees</div>}
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>ð {modules.length} module{modules.length !== 1 ? 's' : ''}</div>
          </div>
        </div>

        {/* Main content area */}
        <div style={{ flex: 1 }}>
          {!assignation && !isAdmin ? (
            /* Welcome screen before starting */
            <div style={{ backgroundColor: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>ð</div>
              <h2 style={{ margin: '0 0 10px', fontSize: 22 }}>{formation.titre}</h2>
              {formation.description && <p style={{ color: '#6b7280', lineHeight: 1.6, marginBottom: 28, maxWidth: 500, margin: '0 auto 28px' }}>{formation.description}</p>}
              <button onClick={startFormation}
                style={{ padding: '12px 32px', backgroundColor: '#1e40af', color: 'white', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
                â¶ï¸ Commencer la formation
              </button>
            </div>
          ) : activeModule ? (
            /* Module content */
            <div style={{ backgroundColor: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: 32 }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                  Module {modules.findIndex(m => m.id === activeModule.id) + 1} / {modules.length}
                </div>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>{activeModule.titre}</h2>
              </div>

              <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 20, marginBottom: 24 }}>
                {activeModule.contenu ? (
                  <div style={{ fontSize: 15, lineHeight: 1.7, color: '#374151', whiteSpace: 'pre-wrap' }}>{activeModule.contenu}</div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>ð</div>
                    <p>Ce module ne contient pas encore de contenu.</p>
                  </div>
                )}
              </div>

              {(assignation && assignation.statut !== 'complete') && (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => markModuleComplete(activeModule.id)}
                    style={{ padding: '10px 24px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    â Marquer comme termine
                  </button>
                </div>
              )}

              {assignation?.statut === 'complete' && (
                <div style={{ textAlign: 'center', padding: '20px', backgroundColor: '#f0fdf4', borderRadius: 8, border: '1px solid #86efac' }}>
                  <div style={{ fontSize: 28 }}>ð</div>
                  <div style={{ fontWeight: 700, color: '#16a34a', marginTop: 6 }}>Formation completee !</div>
                  <Link href={'/certificats'} style={{ display: 'inline-block', marginTop: 12, padding: '8px 20px', backgroundColor: '#16a34a', color: 'white', borderRadius: 6, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
                    ð Voir mon certificat
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div style={{ backgroundColor: 'white', borderRadius: 10, padding: 40, textAlign: 'center', color: '#9ca3af' }}>
              Selectionnez un module A  gauche pour commencer
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
