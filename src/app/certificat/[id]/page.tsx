import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CertificatPDF from '@/components/CertificatPDF'

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function CertificatPage({ params }: PageProps) {
    const { id } = await params
    const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

  const { data: employe } = await supabase
      .from('employes')
      .select('id, prenom, nom, departement')
      .eq('auth_user_id', user.id)
      .single()

  if (!employe) redirect('/login')

  const { data: cert } = await supabase
      .from('certificats')
      .select('*, formations(titre, categorie, niveau, description)')
      .eq('id', id)
      .eq('employe_id', employe.id)
      .eq('valide', true)
      .single()

  if (!cert) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (
        <CertificatPDF
                certificat={cert as any}
                employe={employe as any}
              />
      )
}
