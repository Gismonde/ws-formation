import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const serviceRole = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function AdminFormationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get current user role using service role to avoid RLS recursion
  let userRole = 'employe'
  if (user) {
    const { data: moi } = await serviceRole
      .from('employes')
      .select('role')
      .eq('auth_user_id', user.id)
      .single()
    userRole = moi?.role ?? 'employe'
  }

  const isAdmin = userRole === 'admin'
  const isGestionnaireOrAdmin = userRole === 'admin' || userRole === 'gestionnaire'

  const { data: formations } = await supabase.from('formations').select('*, employes!creee_par(prenom, nom)').order('created_at', { ascending: false })
  const { data: stats } = await supabase.from('modules').select('formation_id')
  const { data: assignStats } = await supabase.from('assignations').select('formation_id')
  const modulesCount = (id: string) => stats?.filter((m: any) => m.formation_id === id).length ?? 0
  const assignCount = (id: string) => assignStats?.filter((a: any) => a.formation_id === id).length ?? 0

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Formations</h1>
          <p className="text-gray-500 text-sm mt-1">{formations?.length ?? 0} formation(s)</p>
        </div>
        {isAdmin && (
          <Link href="/admin/formations/nouvelle" className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg font-medium hover:bg-indigo-700 transition-colors">
            + Nouvelle formation
          </Link>
        )}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Titre','Catégorie','Niveau','Modules','Assignées','Statut',''].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {formations?.map((f: any) => (
              <tr key={f.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-5 py-3.5 font-medium text-gray-900">{f.titre}</td>
                <td className="px-5 py-3.5 text-gray-500">{f.categorie ?? '—'}</td>
                <td className="px-5 py-3.5"><span className={`text-xs px-2 py-0.5 rounded font-medium ${f.niveau==='debutant'?'bg-green-50 text-green-700':f.niveau==='intermediaire'?'bg-yellow-50 text-yellow-700':'bg-red-50 text-red-700'}`}>{f.niveau}</span></td>
                <td className="px-5 py-3.5 text-center text-gray-600">{modulesCount(f.id)}</td>
                <td className="px-5 py-3.5 text-center text-gray-600">{assignCount(f.id)}</td>
                <td className="px-5 py-3.5"><span className={`text-xs px-2 py-0.5 rounded font-medium ${f.publiee?'bg-green-50 text-green-700':'bg-gray-100 text-gray-500'}`}>{f.publiee?'Publiée':'Brouillon'}</span></td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    {isGestionnaireOrAdmin && (
                      <Link href={`/admin/formations/${f.id}/assigner`} className="text-green-600 hover:text-green-800 font-medium text-xs">Assigner</Link>
                    )}
                    {isAdmin && (
                      <Link href={`/admin/formations/${f.id}/modifier`} className="text-indigo-600 hover:text-indigo-800 font-medium text-xs">Modifier</Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
