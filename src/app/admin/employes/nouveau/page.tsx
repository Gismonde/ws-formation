import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NouvelEmployeForm from './NouvelEmployeForm'

export default async function NouvelEmployePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: emp } = await supabase.from('employes').select('role').eq('auth_user_id', user.id).single()
  if (!emp || emp.role !== 'admin') redirect('/admin')

  const { data: departements } = await supabase.from('departements').select('id, nom').order('nom')

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <a href="/admin/employes" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          ← Retour aux employés
        </a>
        <h1 className="text-2xl font-bold text-gray-900 mt-3">Créer un employé</h1>
        <p className="text-gray-500 text-sm mt-1">Créer un nouveau compte employé</p>
      </div>
      <NouvelEmployeForm departements={departements || []} />
    </div>
  )
}
