import { redirect } from 'next/navigation'
import { getActeur, serviceClient, cliniquesAdministrees } from '@/lib/permissions'
import { estAdministrateur } from '@/lib/cliniques'
import { chargerAccueil } from '@/lib/accueil-serveur'
import { ACCUEIL_PAR_DEFAUT } from '@/lib/accueil'
import EditeurAccueil from './EditeurAccueil'

export default async function AdminAccueilPage() {
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!estAdministrateur(acteur.role)) redirect('/admin')
  const sb = serviceClient()
  const cliniques = cliniquesAdministrees(acteur)
  const pages = await Promise.all(cliniques.map(async c => ({ clinique: c, ...(await chargerAccueil(sb, c)), defaut: ACCUEIL_PAR_DEFAUT[c] })))
  return <EditeurAccueil pages={pages} />
}
