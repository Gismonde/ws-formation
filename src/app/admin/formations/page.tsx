import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function AdminFormationsPage() {
  const supabase = await createClient()
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
        <Link href="/admin/formations/nouvelle">
          <Link href="/formations" target="_blank"><button className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-5 py-2.5 rounded-lg transition border border-gray-200">ð AperÃ§u employÃ©</button></Link>
        <Link href="/admin/formations/nouvelle"><button className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-lg transition">+ Nouvelle formation</button></Link>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Titre','CatÃÂ©gorie','Niveau','Modules','AssignÃÂ©es','Statut',''].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {formations?.map((f: any) => (
              <tr key={f.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-5 py-3.5 font-medium text-gray-900">{f.titre}</td>
                <td className="px-5 py-3.5 text-gray-500">{f.categorie ?? 'Ã¢ÂÂ'}</td>
                <td className="px-5 py-3.5"><span className={`text-xs px-2 py-0.5 rounded font-medium ${f.niveau==='debutant'?'bg-green-50 text-green-700':f.niveau==='intermediaire'?'bg-yellow-50 text-yellow-700':'bg-red-50 text-red-700'}`}>{f.niveau}</span></td>
                <td className="px-5 py-3.5 text-center text-gray-600">{modulesCount(f.id)}</td>
                <td className="px-5 py-3.5 text-center text-gray-600">{assignCount(f.id)}</td>
                <td className="px-5 py-3.5"><span className={`text-xs px-2 py-0.5 rounded font-medium ${f.publiee?'bg-green-50 text-green-700':'bg-gray-100 text-gray-500'}`}>{f.publiee?'PubliÃÂ©e':'Brouillon'}</span></td>
                <td className="px-5 py-3.5"><Link href={`/admin/formations/${f.id}/modifier`} className="text-indigo-600 hover:text-indigo-800 font-medium text-xs">Modifier</Link>
                <Link href={`/formations/${f.id}`} target="_blank" className="text-gray-500 hover:text-gray-700 font-medium text-xs">ð AperÃ§u</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}