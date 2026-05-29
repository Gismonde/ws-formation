import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import ToggleActifButton from './ToggleActifButton'

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
    employe: 'bg-blue-50 text-blue-700 border border-blue-200',
  }
  const roleLabel: any = { admin: 'Admin', gestionnaire: 'Gestionnaire', employe: 'Employé' }

  const actifs = employes?.filter((e: any) => e.actif !== false) ?? []
  const archives = employes?.filter((e: any) => e.actif === false) ?? []

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employés</h1>
          <p className="text-gray-500 text-sm mt-1">{actifs.length} employé(s) actif(s)</p>
        </div>
        <Link href="/admin/employes/nouveau" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          + Créer un employé
        </Link>
      </div>

      {/* Active employees table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-10">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Nom</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Département</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Rôle</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Formations</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Certificats</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {actifs.map((emp: any) => (
              <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{emp.prenom} {emp.nom}</div>
                  {emp.poste && <div className="text-xs text-gray-400">{emp.poste}</div>}
                </td>
                <td className="px-4 py-3 text-gray-600">{emp.email}</td>
                <td className="px-4 py-3 text-gray-400 italic">
                  {(emp.departements as any)?.nom ?? 'Non assigné'}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleColor[emp.role] ?? 'bg-gray-100 text-gray-600'}`}>
                    {roleLabel[emp.role] ?? emp.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-gray-700">{nbAssign(emp.id)}</td>
                <td className="px-4 py-3 text-center text-gray-700">{nbCerts(emp.id)}</td>
                <td className="px-4 py-3 text-center">
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">Actif</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Link href={`/admin/employes/${emp.id}/modifier`} className="text-sm text-blue-600 hover:text-blue-800 font-medium border border-blue-200 px-3 py-1 rounded-lg">
                      Modifier
                    </Link>
                    <ToggleActifButton id={emp.id} actif={true} nom={`${emp.prenom} ${emp.nom}`} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Archived employees section */}
      {archives.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-lg font-semibold text-gray-600">Employés archivés</h2>
            <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-1 rounded-full">{archives.length}</span>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden opacity-75">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Nom</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Département</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Rôle</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Formations</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Certificats</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {archives.map((emp: any) => (
                  <tr key={emp.id} className="bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-500">{emp.prenom} {emp.nom}</div>
                      {emp.poste && <div className="text-xs text-gray-400">{emp.poste}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-400">{emp.email}</td>
                    <td className="px-4 py-3 text-gray-400 italic">
                      {(emp.departements as any)?.nom ?? 'Non assigné'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
                        {roleLabel[emp.role] ?? emp.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-400">{nbAssign(emp.id)}</td>
                    <td className="px-4 py-3 text-center text-gray-400">{nbCerts(emp.id)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">Archivé</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Link href={`/admin/employes/${emp.id}/modifier`} className="text-sm text-blue-600 hover:text-blue-800 font-medium border border-blue-200 px-3 py-1 rounded-lg">
                          Dossier
                        </Link>
                        <ToggleActifButton id={emp.id} actif={false} nom={`${emp.prenom} ${emp.nom}`} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
