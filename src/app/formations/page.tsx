import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function FormationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: employe } = await supabase
    .from('employes')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single()

  if (!employe) redirect('/login')

  // Admins et gestionnaires n'ont pas accès à l'espace employé
  if (employe.role === 'admin' || employe.role === 'gestionnaire') {
    redirect('/admin')
  }

  // Récupérer uniquement les formations assignées
  const { data: assignations } = await supabase
    .from('assignations')
    .select('formation_id')
    .eq('employe_id', employe.id)

  const assignedIds = assignations?.map((a: any) => a.formation_id) ?? []

  let formations: any[] = []
  if (assignedIds.length > 0) {
    const { data } = await supabase
      .from('formations')
      .select('*')
      .eq('publiee', true)
      .in('id', assignedIds)
      .order('created_at', { ascending: false })
    formations = data ?? []
  }

  const niveauLabel: any = {
    debutant: '🟢 Débutant',
    intermediaire: '🟡 Intermédiaire',
    avance: '🔴 Avancé'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Link href="/dashboard" className="text-gray-500 hover:text-gray-900 text-sm">← Tableau de bord</Link>
          <h1 className="font-semibold text-gray-900">Mes formations</h1>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-6 py-8">
        {formations.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-4xl mb-3">📚</p>
            <p className="text-gray-500">Aucune formation ne vous a encore été assignée.</p>
            <p className="text-gray-400 text-sm mt-1">Contactez votre administrateur pour en savoir plus.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {formations.map((f: any) => (
              <Link key={f.id} href={`/formations/${f.id}`}>
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md hover:border-indigo-300 transition">
                  <div className="bg-gradient-to-br from-indigo-500 to-purple-600 h-32 flex items-center justify-center">
                    <span className="text-white text-4xl">📚</span>
                  </div>
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded">{f.categorie}</span>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">{f.titre}</h3>
                    <p className="text-gray-500 text-sm line-clamp-2 mb-3">{f.description}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{niveauLabel[f.niveau]}</span>
                      {f.duree_estimee_minutes && <span>⏱ {f.duree_estimee_minutes} min</span>}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
