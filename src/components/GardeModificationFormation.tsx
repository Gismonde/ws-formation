import { redirect } from 'next/navigation'
import { getActeur, peutCreerFormations } from '@/lib/permissions'
import { refusModification } from '@/lib/droits-formation'

/** Éditeur et paramètres d'une formation : un gestionnaire n'y accède que pour les formations qu'il a créées. */
export default async function GardeModificationFormation({ formationId, children }: { formationId: string; children: React.ReactNode }) {
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!peutCreerFormations(acteur)) redirect('/admin/formations?refus=creation')
  if (await refusModification(acteur, formationId)) redirect(`/admin/formations/${formationId}?refus=modification`)
  return <>{children}</>
}
