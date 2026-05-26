import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: employe } = await supabase.from('employes').select('*').eq('id', user.id).single()
  if (!employe) redirect('/login')

  const { data: formations } = await supabase.from('vue_formations_employe').select('*').eq('employe_id', employe.id)

  const enCours = formations?.filter((f: any) => f.statut_global === 'en_cours') ?? []
  const nonCommence = formations?.filter((f: any) => f.statut_global === 'non_commence') ?? []
  const terminees = formations?.filter((f: any) => ['termine','certifie'].includes(f.statut_global)) ?? []

  const couleurStatut = (s: string) => ({non_commence:'bg-gray-100 text-gray-700',en_cours:'bg-blue-100 text-blue-700',termine:'bg-green-100 text-green-700',certifie:'bg-purple-100 text-purple-700'}[s] ?? 'bg-gray-100 text-gray-700')
  const labelStatut = (s: string) => ({non_commence:'à commencer',en_cours:'En cours',termine:'Terminé',certifie:'Certifié ✓'}[s] ?? s)

  const handleLogout = async () => { 'use server'; const { createClient: cc } = await import('@/lib/supabase/server'); const sb = await cc(); await sb.auth.signOut(); redirect('/login') }

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
            {['admin','gestionnaire'].includes(employe.role) && (
              <Link href="/admin/formations" className="text-indigo-600 font-medium text-sm">Admin</Link>
            )}
            <form action={handleLogout}><button className="text-sm text-gray-500 hover:text-gray-900">Déconnexion</button></form>
          </div>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Bonjour, {employe.prenom} 👋</h1>
          <p className="text-gray-500 mt-1">{employe.poste ?? employe.role} — {employe.departement ?? ''}</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[{label:'Formations assignées',value:formations?.length??0},{label:'En cours',value:enCours.length},{label:'Terminées',value:terminees.length},{label:'Certificats',value:formations?.filter((f:any)=>f.statut_global==='certifie').length??0}].map(stat=>(
            <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
        {enCours.length > 0 && <section className="mb-6"><h2 className="text-lg font-semibold mb-3">🔵 En cours</h2><div className="grid md:grid-cols-2 gap-4">{enCours.map((f:any)=><CarteFormation key={f.formation_id} f={f} couleurStatut={couleurStatut} labelStatut={labelStatut}/>)}</div></section>}
        {nonCommence.length > 0 && <section className="mb-6"><h2 className="text-lg font-semibold mb-3">⚪ À commencer</h2><div className="grid md:grid-cols-2 gap-4">{nonCommence.map((f:any)=><CarteFormation key={f.formation_id} f={f} couleurStatut={couleurStatut} labelStatut={labelStatut}/>)}</div></section>}
        {terminees.length > 0 && <section><h2 className="text-lg font-semibold mb-3">✅ Terminées</h2><div className="grid md:grid-cols-2 gap-4">{terminees.map((f:any)=><CarteFormation key={f.formation_id} f={f} couleurStatut={couleurStatut} labelStatut={labelStatut}/>)}</div></section>}
      </main>
    </div>
  )
}

function CarteFormation({f,couleurStatut,labelStatut}:{f:any,couleurStatut:(s:string)=>string,labelStatut:(s:string)=>string}) {
  const prioriteColor:any={basse:'text-gray-400',normale:'text-blue-500',haute:'text-orange-500',obligatoire:'text-red-500'}
  return (
    <Link href={`/formations/${f.formation_id}`}>
      <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-indigo-300 transition cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-gray-900 text-sm leading-tight">{f.formation_titre}</h3>
          <span className={`text-xs font-medium px-2 py-1 rounded-full ml-2 shrink-0 ${couleurStatut(f.statut_global)}`}>{labelStatut(f.statut_global)}</span>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-gray-400">{f.categorie}</span>
          <span className={`text-xs font-medium ${prioriteColor[f.priorite]}`}>{f.priorite}</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5 mb-1">
          <div className="bg-indigo-500 h-1.5 rounded-full" style={{width:`${f.progression_pct}%`}}/>
        </div>
        <div className="flex justify-between text-xs text-gray-400">
          <span>{f.progression_pct}% complété</span>
          {f.date_echeance && <span>Éch: {new Date(f.date_echeance).toLocaleDateString('fr-CA')}</span>}
        </div>
      </div>
    </Link>
  )
}