import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { redirect, notFound } from 'next/navigation'
import EditEmployeForm from './EditEmployeForm'

export default async function EditEmployePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Use service role client to bypass RLS (avoids 42P17 infinite recursion)
  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: emp } = await adminSupabase
    .from('employes')
    .select('role')
    .eq('auth_user_id', user.id)
    .single()

  if (!emp || (emp.role !== 'admin' && emp.role !== 'gestionnaire')) redirect('/admin')

  const { data: employe } = await adminSupabase
    .from('employes')
    .select('*, departements(id, nom)')
    .eq('id', id)
    .single()

  if (!employe) notFound()

  const { data: departements } = await adminSupabase
    .from('departements')
    .select('id, nom')
    .order('nom')

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <div className="mb-6">
        <a href="/admin/employes" className="text-sm text-blue-600 hover:underline">← Retour aux employés</a>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Modifier l&apos;employé</h1>
        <p className="text-gray-500 text-sm mt-1">{employe.prenom} {employe.nom}</p>
      </div>
      <EditEmployeForm employe={employe} departements={departements || []} />
    </div>
  )
}
