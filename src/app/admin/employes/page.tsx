import { createClient } from '@/lib/supabase/server'

export default async function AdminEmployesPage() {
  const supabase = await createClient()
  const { data: employes } = await supabase.from('employes').select('*').order('nom')
  const { data: formations } = await supabase.from('formations').select('id, titre').eq('publiee', true)
  const { data: assignations } = await supabase.from('assignations').select('employe_id, formation_id')
  const { data: certificats } = await supabase.from('certificats').select('employe_id').eq('valide', true)

  const nbAssign = (id: string) => assignations?.filter((a: any) => a.employe_id === id).length ?? 0
  const nbCerts = (id: string) => certificats?.filter((c: any) => c.employe_id === id).length ?? 0

  const roleColor: any = { admin: 'bg-red-50 text-red-700', gestionnaire: 'bg-orange-50 text-orange-700', employe: 'bg-blue-50 text-blue-700' }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employés</h1>
          <p className="text-gray-500 text-sm mt-1">{employes?.length ?? 0} employé(s)</p>
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Nom','Email','Département','Rôle','Formations','Certificats','Statut'].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employes?.map((e: any) => (
              <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-5 py-3.5 font-medium text-gray-900">{e.prenom} {e.nom}</td>
                <td className="px-5 py-3.5 text-gray-500">{e.email}</td>
                <td className="px-5 py-3.5 text-gray-500">{e.departement ?? '—'}</td>
                <td className="px-5 py-3.5"><span className={`text-xs px-2 py-0.5 rounded font-medium ${roleColor[e.role]}`}>{e.role}</span></td>
                <td className="px-5 py-3.5 text-center">{nbAssign(e.id)}</td>
                <td className="px-5 py-3.5 text-center">{nbCerts(e.id)}</td>
                <td className="px-5 py-3.5"><span className={`text-xs px-2 py-0.5 rounded font-medium ${e.actif?'bg-green-50 text-green-700':'bg-gray-100 text-gray-500'}`}>{e.actif?'Actif':'Inactif'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}