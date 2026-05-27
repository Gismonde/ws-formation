import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function AdminEmployesPage() {
  const supabase = await createClient()
  const { data: employes } = await supabase.from('employes').select('*, departements(nom)').order('nom')
  const { data: assignations } = await supabase.from('assignations').select('employe_id, formation_id')
  const { data: certificats } = await supabase.from('certificats').select('employe_id').eq('valide', true)

  const nbAssign = (id: string) => assignations?.filter((a: any) => a.employe_id === id).length ?? 0
  const nbCerts = (id: string) => certificats?.filter((c: any) => c.employe_id === id).length ?? 0

  const roleColor: any = {
    admin: 'bg-red-50 text-red-700 border border-red-200',
    gestionnaire: 'bg-orange-50 text-orange-700 border border-orange-200',
    employe: 'bg-blue-50 text-blue-700 border border-blue-200'
  }
  const roleLabel: any = { admin: 'Admin', gestionnaire: 'Gestionnaire', employe: 'Employe' }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employes</h1>
          <p className="text-gray-500 text-sm mt-1">{employes?.length ?? 0} employe(s) au total</p>
        </div>
        <Link href="/admin/employes/nouveau"
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + Nouvel employe
        </Link>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Nom','Email','Departement','Role','Formations','Certificats','Statut','Actions'].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employes?.map((e: any) => (
              <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-5 py-3.5 font-medium text-gray-900">
                  <div>{e.prenom} {e.nom}</div>
                  {e.poste && <div className="text-xs text-gray-400 mt-0.5">{e.poste}</div>}
                </td>
                <td className="px-5 py-3.5 text-gray-500">{e.email}</td>
                <td className="px-5 py-3.5 text-gray-500">
                  {e.departements?.nom ?? <span className="text-gray-300 italic text-xs">Non assigne</span>}
                </td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${roleColor[e.role] || roleColor.employe}`}>
                    {roleLabel[e.role] || e.role}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-gray-700">{nbAssign(e.id)}</td>
                <td className="px-5 py-3.5 text-gray-700">{nbCerts(e.id)}</td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${e.actif ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-500'}`}>
                    {e.actif ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <Link href={`/admin/employes/${e.id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors">
                    Modifier
                  </Link>
                </td>
              </tr>
            ))}
            {(!employes || employes.length === 0) && (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-gray-400">
                  Aucun employe.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
