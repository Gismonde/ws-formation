import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'

export default async function AdminRapportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminSupabase = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: moi } = await adminSupabase
    .from('employes')
    .select('role, departement_id')
    .eq('auth_user_id', user!.id)
    .single()

  const isGestionnaire = moi?.role === 'gestionnaire'
  const monDeptId = moi?.departement_id

  const { data: formations } = await adminSupabase.from('formations').select('id, titre, categorie').eq('publiee', true)

  let empQuery = adminSupabase.from('employes').select('id').eq('actif', true)
  if (isGestionnaire && monDeptId) empQuery = empQuery.eq('departement_id', monDeptId)
  const { data: employes } = await empQuery

  const { data: certificats } = await adminSupabase.from('certificats').select('*').eq('valide', true)
  const { data: progressions } = await adminSupabase.from('vue_formations_employe').select('*')

  // Filtrer progressions par département si gestionnaire
  const progsFiltrees = (isGestionnaire && monDeptId)
    ? progressions?.filter((p: any) => employes?.some((e: any) => e.id === p.employe_id)) ?? []
    : progressions ?? []

  const totalFormations = formations?.length ?? 0
  const totalEmployes = employes?.length ?? 0
  const totalCertificats = certificats?.length ?? 0
  const terminees = progsFiltrees.filter((p: any) => ['termine','certifie'].includes(p.statut_global)).length
  const enCours = progsFiltrees.filter((p: any) => p.statut_global === 'en_cours').length
  const tauxCompletion = progsFiltrees.length ? Math.round((terminees / progsFiltrees.length) * 100) : 0

  const stats = [
    { label: 'Formations actives', value: totalFormations, color: 'indigo', icon: '📚' },
    { label: 'Employés actifs', value: totalEmployes, color: 'blue', icon: '👥' },
    { label: 'Taux de complétion', value: tauxCompletion + '%', color: 'emerald', icon: '📈' },
    { label: 'Certificats émis', value: totalCertificats, color: 'purple', icon: '🏆' },
  ]

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Tableau de bord</h1>
      {isGestionnaire && monDeptId && (
        <p className="text-sm text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-4 py-2 mb-6">
          Vous consultez les données de votre département uniquement.
        </p>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className={`bg-white rounded-xl border border-gray-200 p-5`}>
            <div className="text-3xl mb-2">{s.icon}</div>
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="text-sm text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Progression par formation</h2>
          {formations?.length === 0 ? (
            <p className="text-gray-400 text-sm">Aucune formation publiée</p>
          ) : (
            <div className="space-y-3">
              {formations?.map((f: any) => {
                const total = progsFiltrees.filter((p: any) => p.formation_id === f.id).length
                const done = progsFiltrees.filter((p: any) => p.formation_id === f.id && ['termine','certifie'].includes(p.statut_global)).length
                return (
                  <div key={f.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700 truncate">{f.titre}</span>
                      <span className="text-gray-400 ml-2">{done}/{total}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full">
                      <div className="h-1.5 bg-indigo-400 rounded-full" style={{ width: total ? `${Math.round(done/total*100)}%` : '0%' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Derniers certificats émis</h2>
          {totalCertificats === 0 ? (
            <p className="text-gray-400 text-sm">Aucun certificat encore</p>
          ) : (
            <p className="text-gray-600 text-sm">{totalCertificats} certificat(s) validé(s)</p>
          )}
        </div>
      </div>
    </div>
  )
}
