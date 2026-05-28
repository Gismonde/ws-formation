import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Try to find employe by auth_user_id first
  let { data: employe, error: empError } = await supabase
    .from('employes')
    .select('id, prenom, nom, role, departement, poste, email, actif')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  // Fallback: if not found by auth_user_id, try by email and auto-link
  if (!employe && !empError && user.email) {
    const { data: employeByEmail, error: emailError } = await supabase
      .from('employes')
      .select('id, prenom, nom, role, departement, poste, email, actif')
      .eq('email', user.email)
      .maybeSingle()

    if (employeByEmail && !emailError) {
      await supabase
        .from('employes')
        .update({ auth_user_id: user.id })
        .eq('id', employeByEmail.id)
      employe = employeByEmail
    }
  }

  // If there's a DB error (e.g. RLS policy issue), show helpful error
  if (empError) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f4ff', fontFamily: 'sans-serif' }}>
        <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '12px', maxWidth: '500px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚠️</div>
          <h1 style={{ color: '#dc2626', marginBottom: '8px' }}>Erreur de configuration</h1>
          <p style={{ color: '#6b7280' }}>Une erreur de base de données empêche l'accès au tableau de bord.</p>
          <p style={{ color: '#9ca3af', fontSize: '12px', marginTop: '8px' }}>Code: {empError.code} - {empError.message}</p>
          <p style={{ color: '#6b7280', marginTop: '16px' }}>Contactez votre administrateur.</p>
        </div>
      </div>
    )
  }

  if (!employe) redirect('/login')

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

  const { data: progressions } = await supabase
    .from('progressions')
    .select('formation_id, module_id, statut')
    .eq('employe_id', employe.id)

  const { data: certificats } = await supabase
    .from('certificats')
    .select('formation_id')
    .eq('employe_id', employe.id)

  const certSet = new Set(certificats?.map((c: any) => c.formation_id) ?? [])

  const formationsAvecProgression = await Promise.all(
    formations.map(async (f: any) => {
      const { data: modules } = await supabase
        .from('modules')
        .select('id')
        .eq('formation_id', f.id)
      const total = modules?.length ?? 0
      const termines = progressions?.filter(
        (p: any) => p.formation_id === f.id && p.statut === 'termine'
      ).length ?? 0
      const pct = total > 0 ? Math.round((termines / total) * 100) : 0
      return { ...f, progressionPct: pct, certifie: certSet.has(f.id) }
    })
  )

  const termineeCount = formationsAvecProgression.filter(f => f.progressionPct === 100).length
  const enCoursCount = formationsAvecProgression.filter(f => f.progressionPct > 0 && f.progressionPct < 100).length

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-md flex items-center justify-center">
              <span className="text-white text-xs font-bold">WS</span>
            </div>
            <span className="font-semibold text-gray-900">WS Formation</span>
          </div>
          <span className="text-sm text-gray-600">{employe.prenom} {employe.nom}</span>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bonjour, {employe.prenom} !</h1>
            <p className="text-gray-500 mt-1">Voici vos formations assignées.</p>
          </div>
          {(employe.role === 'admin' || employe.role === 'gestionnaire') && (
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              ⚙️ Espace Admin
            </Link>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-3xl font-bold text-indigo-600">{formationsAvecProgression.length}</p>
            <p className="text-sm text-gray-500 mt-1">Formation(s) assignee(s)</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-3xl font-bold text-amber-500">{enCoursCount}</p>
            <p className="text-sm text-gray-500 mt-1">En cours</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-3xl font-bold text-green-600">{termineeCount}</p>
            <p className="text-sm text-gray-500 mt-1">Terminee(s)</p>
          </div>
        </div>

        {formationsAvecProgression.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-4xl mb-3">📚</p>
            <p className="text-gray-500">Aucune formation ne vous a encore ete assignee.</p>
            <p className="text-gray-400 text-sm mt-1">Contactez votre administrateur pour en savoir plus.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {formationsAvecProgression.map((f: any) => (
              <Link key={f.id} href={`/formations/${f.id}`}>
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md hover:border-indigo-300 transition cursor-pointer">
                  <div className="bg-gradient-to-br from-indigo-500 to-purple-600 h-28 flex items-center justify-center relative">
                    <span className="text-white text-4xl">📚</span>
                    {f.certifie && (
                      <span className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded-full">🏆 Certifie</span>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">{f.titre}</h3>
                    <p className="text-gray-500 text-sm line-clamp-2 mb-3">{f.description}</p>
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Progression</span>
                        <span className="font-medium">{f.progressionPct}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${f.progressionPct === 100 ? 'bg-green-500' : 'bg-indigo-500'}`}
                          style={{ width: `${f.progressionPct}%` }}
                        />
                      </div>
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
