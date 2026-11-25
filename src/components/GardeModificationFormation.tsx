import { redirect } from 'next/navigation'
import { getActeur, peutEditerFormations, peutCreerFormations } from '@/lib/permissions'
import { refusModification } from '@/lib/droits-formation'

/** Éditeur et paramètres d'une formation : un gestionnaire n'y accède que pour les formations qu'il a créées, ou celle qu'il valide. */
export default async function GardeModificationFormation({ formationId, reglages = false, children }: { formationId: string; reglages?: boolean; children: React.ReactNode }) {
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  // Réglages (clinique, responsable, suppression…) : créateurs seulement ; le validateur corrige le contenu
  if (reglages ? !peutCreerFormations(acteur) : !peutEditerFormations(acteur)) redirect(reglages ? `/admin/formations/${formationId}?refus=modification` : '/admin/formations?refus=creation')
  if (await refusModification(acteur, formationId)) redirect(`/admin/formations/${formationId}?refus=modification`)
  return <>{children}</>
}
