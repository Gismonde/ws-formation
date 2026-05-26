import { createClient } from '@/lib/supabase/server'

export default async function AdminRapportsPage() {
  const supabase = await createClient()
  const { data: formations } = await supabase.from('formations').select('id, titre, categorie').eq('publiee', true)
  const { data: employes } = await supabase.from('employes').select('id').eq('actif', true).eq('role', 'employe')
  const { data: certificats } = await supabase.from('certificats').select('*').eq('valide', true)
  const { data: progressions } = await supabase.from('vue_formations_employe').select('*')

  const totalFormations = formations?.length ?? 0
  const totalEmployes = employes?.length ?? 0
  const totalCertificats = certificats?.length ?? 0
  const terminees = progressions?.filter((p: any) => ['termine','certifie'].includes(p.statut_global)).length ?? 0
  const enCours = progressions?.filter((p: any) => p.statut_global === 'en_cours').length ?? 0
  const tauxCompletion = progressions?.length ? Math.round((terminees / progressions.length) * 100) : 0

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Tableau de bord</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          {label:'Formations actives',value:totalFormations,color:'indigo',icon:'📚'},
          {label:'Employés actifs',value:totalEmployes,color:'blue',icon:'👥'},
          {label:'Taux de complétion',value:tauxCompletion+'%',color:'green',icon:'📈'},
          {label:'Certificats émis',value:totalCertificats,color:'purple',icon:'🏆'},
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-2xl mb-2">{stat.icon}</div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Progression par formation</h2>
          <div className="space-y-3">
            {formations?.map((f: any) => {
              const fProgs = progressions?.filter((p: any) => p.formation_id === f.id) ?? []
              const fTermines = fProgs.filter((p: any) => ['termine','certifie'].includes(p.statut_global)).length
              const pct = fProgs.length ? Math.round((fTermines / fProgs.length) * 100) : 0
              return (
                <div key={f.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 truncate">{f.titre}</span>
                    <span className="text-gray-500 ml-2">{fTermines}/{fProgs.length}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-indigo-500 h-2 rounded-full" style={{width:`${pct}%`}}/>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Derniers certificats émis</h2>
          <div className="space-y-3">
            {certificats?.slice(0, 8).map((c: any) => (
              <div key={c.id} className="flex items-center justify-between">
                <span className="text-xs font-mono text-purple-600">{c.numero_certificat}</span>
                <span className="text-xs text-gray-400">{new Date(c.date_emission).toLocaleDateString('fr-CA')}</span>
              </div>
            ))}
            {!certificats?.length && <p className="text-sm text-gray-400 text-center py-4">Aucun certificat encore</p>}
          </div>
        </div>
      </div>
    </div>
  )
}