import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import SopAdminClient from './SopAdminClient'

export default async function SopAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verifier que l'utilisateur est admin
  const { data: employe } = await supabase
    .from('employes')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single()

  if (!employe || !['admin', 'super_admin'].includes(employe.role ?? '')) {
    redirect('/dashboard')
  }

  // Utiliser le service client pour lire TOUTES les SOPs (bypass RLS)
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: sops } = await serviceClient
    .from('sop')
    .select('*')
    .order('acces_role', { ascending: true })
    .order('titre', { ascending: true })

  return <SopAdminClient initialSops={sops ?? []} />
}
