import { redirect } from 'next/navigation'
import { getActeur, peutCreerFormations } from '@/lib/permissions'

/** Bloque l'accès aux écrans de création/modification de formations
 *  pour qui n'en a pas l'autorisation (admins, ou gestionnaires autorisés). */
export default async function GardeCreateurFormations({ children }: { children: React.ReactNode }) {
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!peutCreerFormations(acteur)) redirect('/admin/formations?refus=creation')
  return <>{children}</>
}
