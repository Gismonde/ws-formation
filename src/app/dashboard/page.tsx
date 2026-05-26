'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function DashboardPage() {
  const [employe, setEmploye] = useState<any>(null)
  const [formations, setFormations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.replace('/login'); return }

      const { data: emp } = await supabase.from('employes').select('*').eq('id', user.id).single()
      if (!emp) { window.location.replace('/login'); return }
      setEmploye(emp)

      const { data: f } = await supabase.from('vue_formations_employe').select('*').eq('employe_id', emp.id)
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

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-500">Chargement...</div>
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
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Bonjour, {employe?.prenom} 👋</h1>
          <p className="text-gray-500 mt-1">{employe?.poste ?? employe?.role}</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[{label:'Formations assignées',value:formations.length},{label:'En cours',value:enCours.length},{label:'Terminées',value:terminees.length},{label:'Certificats',value:formations.filter(f=>f.statut_global==='certifie').length}].map(stat=>(
            <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
        {enCours.length > 0 && <section className="mb-6"><h2 className="text-lg font-semibold mb-3">🔵 En cours</h2><div className="grid md:grid-cols-2 gap-4">{enCours.map(f=><CarteFormation key={f.formation_id} f={f} couleurStatut={couleurStatut} labelStatut={labelStatut}/>)}</div></section>}
        {nonCommence.length > 0 && <section className="mb-6"><h2 className="text-lg font-semibold mb-3">⚪ À commencer</h2><div className="grid md:grid-cols-2 gap-4">{nonCommence.map(f=><CarteFormation key={f.formation_id} f={f} couleurStatut={couleurStatut} labelStatut={labelStatut}/>)}</div></section>}
        {terminees.length > 0 && <section><h2 className="text-lg font-semibold mb-3">✅ Terminées</h2><div className="grid md:grid-cols-2 gap-4">{terminees.map(f=><CarteFormation key={f.formation_id} f={f} couleurStatut={couleurStatut} labelStatut={labelStatut}/>)}</div></section>}
        {formations.length === 0 && <div className="text-center py-12 text-gray-400">Aucune formation assignée pour le moment.</div>}
      </main>
    </div>
  )
}

function CarteFormation({f,couleurStatut,labelStatut}:{f:any,couleurStatut:(s:string)=>string,labelStatut:(s:string)=>string}) {
  return (
    <Link href={`/formations/${f.formation_id}`}>
      <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-indigo-300 transition cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-gray-900 text-sm leading-tight">{f.formation_titre}</h3>
          <span className={`text-xs font-medium px-2 py-1 rounded-full ml-2 shrink-0 ${couleurStatut(f.statut_global)}`}>{labelStatut(f.statut_global)}</span>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-gray-400">{f.categorie}</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5 mb-1">
          <div className="bg-indigo-500 h-1.5 rounded-full" style={{width:`${f.progression_pct || 0}%`}}/>
        </div>
        <p className="text-xs text-gray-400">{f.progression_pct || 0}% complété</p>
      </div>
    </Link>
  )
}
