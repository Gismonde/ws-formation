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
  departement: string | null
  poste: string | null
  actif: boolean
}

export default function DashboardPage() {
  const [employe, setEmploye] = useState<Employe | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function loadProfile() {
      try {
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

        if (dbError || !data) {
          setError('Profil introuvable. Contactez votre administrateur.')
          setLoading(false)
          return
        }

        setEmploye(data)
        setLoading(false)

        // Redirect based on role
        if (data.role === 'admin') {
          router.replace('/admin')
        }
      } catch (e) {
        setError('Erreur de connexion')
        setLoading(false)
      }
    }

    loadProfile()
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

  if (error) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif', flexDirection: 'column', gap: '16px' }}>
        <p style={{ color: 'red' }}>{error}</p>
        <button onClick={handleLogout} style={{ padding: '8px 16px', cursor: 'pointer' }}>Déconnexion</button>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Bienvenue, {employe?.prenom} {employe?.nom}</h1>
      <p>Rôle : {employe?.role}</p>
      <button onClick={handleLogout} style={{ marginTop: '16px', padding: '8px 16px', cursor: 'pointer' }}>
        Déconnexion
      </button>
    </div>
  )
}
