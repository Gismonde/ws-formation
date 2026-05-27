import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import EditEmployeForm from './EditEmployeForm'

export default async function EditEmployePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
    const supabase = await createClient()

      const { data: { user } } = await supabase.auth.getUser()
        if (!user) redirect('/login')

          const { data: emp } = await supabase.from('employes').select('role').eq('auth_user_id', user.id).single()
            if (!emp || emp.role !== 'admin') redirect('/admin')

              const { data: employe } = await supabase
                  .from('employes')
                      .select('*, departements(id, nom)')
                          .eq('id', id)
                              .single()

                                if (!employe) notFound()

                                  const { data: departements } = await supabase.from('departements').select('id, nom').order('nom')

                                    return (
                                        <div className="p-8 max-w-2xl mx-auto">
                                              <div className="mb-6">
                                                      <a href="/admin/employes" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
                                                                &larr; Retour aux employes
                                                                        </a>
                                                                                <h1 className="text-2xl font-bold text-gray-900 mt-3">Modifier l&apos;employe</h1>
                                                                                        <p className="text-gray-500 text-sm mt-1">{employe.prenom} {employe.nom}</p>
                                                                                              </div>
                                                                                                    <EditEmployeForm employe={employe} departements={departements || []} />
                                                                                                        </div>
                                                                                                          )
                                                                                                          }
