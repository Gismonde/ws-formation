'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

type Employe = { id: string; auth_user_id: string; prenom: string; nom: string; email: string; role: string; departement_id: string | null; actif: boolean }

export default function DashboardPage() {
  const [employe, setEmploye] = useState<Employe | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

  useEffect(() => {
    async function loadProfile() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) { router.replace('/login'); return }
        const { data, error: dbError } = await supabase.from('employes').select('*').eq('auth_user_id', user.id).single()
        if (dbError || !data) { setError('Profil introuvable. Contactez votre administrateur.'); setLoading(false); return }
        setEmploye(data)
        setLoading(false)
        if (data.role === 'admin' || data.role === 'gestionnaire') { router.replace('/admin') }
      } catch (e) { setError('Erreur de connexion'); setLoading(false) }
    }
    loadProfile()
  }, [])

  const handleLogout = async () => { await supabase.auth.signOut(); router.replace('/login') }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}><p>Chargement...</p></div>

  if (error) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif', flexDirection: 'column', gap: '16px' }}>
      <p style={{ color: 'red' }}>{error}</p>
      <button onClick={handleLogout} style={{ padding: '8px 16px', cursor: 'pointer' }}>Deconnexion</button>
    </div>
  )

  return (
    <div style={{ fontFamily: 'sans-serif', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <header style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '20px', color: '#1e40af' }}>WS Formation</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '14px', color: '#6b7280' }}>Bonjour, {employe?.prenom}</span>
          <button onClick={handleLogout} style={{ padding: '6px 14px', backgroundColor: '#1e40af', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Deconnexion
          </button>
        </div>
      </header>
      <main style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
        <h2>Mes formations</h2>
        <a href="/formations" style={{ display: 'inline-block', padding: '10px 20px', backgroundColor: '#1e40af', color: 'white', borderRadius: '6px', textDecoration: 'none', fontWeight: '600' }}>
          Voir mes formations
        </a>
      </main>
    </div>
  )
}
