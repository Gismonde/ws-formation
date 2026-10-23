// Mode employé : la formation telle que la voit un employé, dans un cadre ordinateur ou téléphone.
import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getActeur, serviceClient, peutVoirContenu } from '@/lib/permissions'
import { aAccesAdmin } from '@/lib/cliniques'
import { COOKIE_APERCU } from '@/lib/apercu-employe'
import CadreApercu from './CadreApercu'

export const dynamic = 'force-dynamic'

export default async function ApercuEmployePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ retour?: string }> }) {
  const { id } = await params
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!aAccesAdmin(acteur)) redirect('/dashboard/accueil')
  const { data: f } = await serviceClient().from('formations').select('id, titre, clinique').eq('id', id).maybeSingle()
  if (!f || !peutVoirContenu(acteur, f.clinique)) notFound()
  // Cookie absent (lien ouvert directement) : on passe par l'activation
  if ((await cookies()).get(COOKIE_APERCU)?.value !== id) redirect(`/api/admin/formations/${id}/mode-employe`)
  const { retour } = await searchParams
  return <CadreApercu formationId={id} titre={f.titre} retour={retour === 'fiche' ? 'fiche' : 'editeur'} />
}
