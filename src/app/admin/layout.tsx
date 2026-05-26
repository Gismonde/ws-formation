import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: employe } = await supabase.from('employes').select('role, prenom, nom').eq('auth_user_id', user.id).single()
  if (!employe || !['admin','gestionnaire'].includes(employe.role)) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-600 rounded-md flex items-center justify-center">
              <span className="text-white text-xs font-bold">WS</span>
            </div>
            <span className="font-semibold text-gray-900 text-sm">Administration</span>
          </div>
        </div>
        <nav className="flex-1 p-3">
          {[{href:'/admin/formations',label:'📚 Formations'},{href:'/admin/employes',label:'👥 Employés'},{href:'/admin/rapports',label:'📊 Rapports'}].map(link => (
            <Link key={link.href} href={link.href} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 mb-1 transition">{link.label}</Link>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-100">
          <p className="text-xs text-gray-500">{employe.prenom} {employe.nom}</p>
          <p className="text-xs text-indigo-500 font-medium mt-0.5">{employe.role}</p>
          <Link href="/dashboard" className="text-xs text-gray-400 hover:text-gray-600 mt-2 block">← Retour app</Link>
        </div>
      </aside>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  )
}