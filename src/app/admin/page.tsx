'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

type Employe = {
  id: string
  auth_user_id: string
  prenom: string
  nom: string
  email: string
  role: string
}

export default function AdminPage() {
  const [employe, setEmploye] = useState<Employe | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function checkAdmin() {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        router.replace('/login')
        return
      }

      const { data, error: dbError } = await supabase
        .from('employes')
        .select('*')
        .eq('auth_user_id', user.id)
        .single()

      if (dbError || !data || data.role !== 'admin') {
        router.replace('/dashboard')
        return
      }

      setEmploye(data)
      setLoading(false)
    }

    checkAdmin()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
        <p>Chargement...</p>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: 'sans-serif', minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <header style={{ backgroundColor: '#1e40af', color: 'white', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '20px' }}>WS Formation — Administration</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '14px' }}>{employe?.prenom} {employe?.nom}</span>
          <button onClick={handleLogout} style={{ padding: '6px 14px', backgroundColor: 'white', color: '#1e40af', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            Déconnexion
          </button>
        </div>
      </header>

      {/* Main content */}
      <main style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
        <h2 style={{ marginBottom: '24px' }}>Tableau de bord administrateur</h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          {/* Card: Employees */}
          <a href="/admin/employes" style={{ textDecoration: 'none' }}>
            <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', cursor: 'pointer', transition: 'box-shadow 0.2s' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>👥</div>
              <h3 style={{ margin: '0 0 8px', color: '#1e40af' }}>Employés</h3>
              <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>Gérer les comptes employés et leurs accès aux formations</p>
            </div>
          </a>

          {/* Card: Formations */}
          <a href="/admin/formations" style={{ textDecoration: 'none' }}>
            <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', cursor: 'pointer' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📚</div>
              <h3 style={{ margin: '0 0 8px', color: '#1e40af' }}>Formations</h3>
              <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>Créer et gérer les formations en ligne</p>
            </div>
          </a>

          {/* Card: Rapports */}
          <a href="/admin/rapports" style={{ textDecoration: 'none' }}>
            <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', cursor: 'pointer' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📊</div>
              <h3 style={{ margin: '0 0 8px', color: '#1e40af' }}>Rapports</h3>
              <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>Suivre la progression et les certificats des employés</p>
            </div>
          </a>
        </div>
      </main>
    </div>
  )
}
