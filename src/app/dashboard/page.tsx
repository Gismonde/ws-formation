'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function DashboardPage() {
  const [employe, setEmploye] = useState<any>(null)
  const [formations, setFormations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [debugInfo, setDebugInfo] = useState<string>('')

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        setDebugInfo('Auth error: ' + (authError?.message || 'no user'))
        window.location.replace('/login')
        return
      }
      
      setDebugInfo('User: ' + user.id)

      const { data: emp, error: empError } = await supabase.from('employes').select('*').eq('id', user.id).single()
      
      if (empError) {
        setDebugInfo(prev => prev + ' | Employe error: ' + empError.message + ' code:' + empError.code)
        // Try without RLS filter for debugging
        const { data: allEmps, error: allErr } = await supabase.from('employes').select('id, email, role').limit(5)
        setDebugInfo(prev => prev + ' | All employes: ' + JSON.stringify(allEmps) + ' err:' + JSON.stringify(allErr))
        setLoading(false)
        return
      }
      
      if (!emp) {
        setDebugInfo(prev => prev + ' | No employee found for id: ' + user.id)
        setLoading(false)
        return
      }
      
      setEmploye(emp)

      const { data: f, error: fError } = await supabase.from('vue_formations_employe').select('*').eq('employe_id', emp.id)
      if (fError) setDebugInfo(prev => prev + ' | Formations error: ' + fError.message)
      setFormations(f || [])
      setLoading(false)
    }
    load()
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.replace('/login')
  }

  if (loading || debugInfo) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center flex-col gap-4 p-8">
      <div className="text-gray-500">{loading ? 'Chargement...' : ''}</div>
      {debugInfo && <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg text-sm text-yellow-800 max-w-2xl break-all">{debugInfo}</div>}
      {!loading && <button onClick={handleLogout} className="text-indigo-600 underline">Déconnexion</button>}
    </div>
  )

  const enCours = formations.filter(f => f.statut_global === 'en_cours')
  const nonCommence = formations.filter(f => f.statut_global === 'non_commence')
  const terminees = formations.filter(f => ['termine','certifie'].includes(f.statut_global))

  const couleurStatut = (s: string) => ({non_commence:'bg-gray-100 text-gray-700',en_cours:'bg-blue-100 text-blue-700',termine:'bg-green-100 text-green-700',certifie:'bg-purple-100 text-purple-700'}[s] ?? 'bg-gray-100 text-gray-700')
  const labelStatut = (s: string) => ({non_commence:'À commencer',en_cours:'En cours',termine:'Terminé',certifie:'Certifié ✓'}[s] ?? s)

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">WS</span>
            </div>
            <span className="font-semibold text-gray-900">WS Formation</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/formations" className="text-gray-600 hover:text-gray-900 text-sm">Formations</Link>
            <Link href="/certificats" className="text-gray-600 hover:text-gray-900 text-sm">Certificats</Link>
            {['admin','gestionnaire'].includes(employe?.role) && (
              <Link href="/admin/formations" className="text-indigo-600 font-medium text-sm">Admin</Link>
            )}
            <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-900">Déconnexion</button>
          </div>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Bonjour, {employe?.prenom} 👋</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[{label:'Formations assignées',value:formations.length},{label:'En cours',value:enCours.length},{label:'Terminées',value:terminees.length},{label:'Certificats',value:formations.filter(f=>f.statut_global==='certifie').length}].map(stat=>(
            <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
        {formations.length === 0 && <div className="text-center py-12 text-gray-400">Aucune formation assignée pour le moment.</div>}
      </main>
    </div>
  )
}
