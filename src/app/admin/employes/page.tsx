import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import ToggleActifButton from './ToggleActifButton'

export default async function AdminEmployesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Charger l'employé connecté pour connaître son rôle et département
  const adminSupabase = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data: moi } = await adminSupabase
    .from('employes')
    .select('role, departement_id')
    .eq('auth_user_id', user.id)
    .single()

  const isGestionnaire = moi?.role === 'gestionnaire'
  const monDeptId = moi?.departement_id

  // Construire la requête selon le rôle
  let query = adminSupabase.from('employes').select('*, departements(nom)').order('nom')
  if (isGestionnaire && monDeptId) {
    query = query.eq('departement_id', monDeptId)
  }
  const { data: employes } = await query

  const { data: assignations } = await adminSupabase.from('assignations').select('employe_id, formation_id')
  const { data: certificats } = await adminSupabase.from('certificats').select('employe_id').eq('valide', true)

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
          <p className="text-gray-500 text-sm mt-1">
            {actifs.length} employé(s) actif(s)
            {isGestionnaire && monDeptId ? ' dans votre département' : ''}
          </p>
        </div>
        {!isGestionnaire && (
          <Link href="/admin/employes/nouveau" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            + Créer un employé
          </Link>
        )}
      </div>

      {/* Table employés actifs */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">NOM</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">EMAIL</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">DÉPARTEMENT</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">RÔLE</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">FORMATIONS</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">CERTIFICATS</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">STATUT</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">ACTIONS</th>
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
                <td className="px-4 py-3 text-gray-500 italic">{emp.departements?.nom ?? 'Non assigné'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${roleColor[emp.role] ?? 'bg-gray-100 text-gray-600'}`}>
                    {roleLabel[emp.role] ?? emp.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-gray-600">{nbAssign(emp.id)}</td>
                <td className="px-4 py-3 text-center text-gray-600">{nbCerts(emp.id)}</td>
                <td className="px-4 py-3 text-center">
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">Actif</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <Link href={`/admin/employes/${emp.id}`} className="text-sm text-blue-600 hover:text-blue-800 font-medium border border-blue-200 px-3 py-1 rounded-lg">
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

      {/* Section employés archivés */}
      {archives.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">
            Employés archivés <span className="ml-2 bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full">{archives.length}</span>
          </h2>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden opacity-75">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">NOM</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">EMAIL</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">DÉPARTEMENT</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">RÔLE</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">FORMATIONS</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">CERTIFICATS</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">STATUT</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {archives.map((emp: any) => (
                  <tr key={emp.id} className="text-gray-400">
                    <td className="px-4 py-3">
                      <div className="font-medium">{emp.prenom} {emp.nom}</div>
                      {emp.poste && <div className="text-xs">{emp.poste}</div>}
                    </td>
                    <td className="px-4 py-3">{emp.email}</td>
                    <td className="px-4 py-3 italic">{emp.departements?.nom ?? 'Non assigné'}</td>
                    <td className="px-4 py-3">{roleLabel[emp.role] ?? emp.role}</td>
                    <td className="px-4 py-3 text-center">{nbAssign(emp.id)}</td>
                    <td className="px-4 py-3 text-center">{nbCerts(emp.id)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-500 border border-gray-200">Archivé</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <Link href={`/admin/employes/${emp.id}`} className="text-sm text-blue-500 font-medium border border-blue-200 px-3 py-1 rounded-lg">
                          Dossier
                        </Link>
                        {!isGestionnaire && <ToggleActifButton id={emp.id} actif={false} nom={`${emp.prenom} ${emp.nom}`} />}
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
