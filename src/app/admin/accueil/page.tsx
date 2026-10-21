import { i18n } from '@/lib/i18n/serveur'
import { redirect } from 'next/navigation'
import { getActeur, serviceClient, cliniquesAdministrees } from '@/lib/permissions'
import { estAdministrateur } from '@/lib/cliniques'
import { chargerAccueil } from '@/lib/accueil-serveur'
import { accueilParDefaut } from '@/lib/accueil'
import EditeurAccueil from './EditeurAccueil'

export default async function AdminAccueilPage() {
  const { t } = await i18n()
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!estAdministrateur(acteur.role)) redirect('/admin')
  const sb = serviceClient()
  const cliniques = cliniquesAdministrees(acteur)
  const pages = await Promise.all(cliniques.flatMap(c => (['fr', 'en'] as const).map(async langue => ({
    clinique: c, langue, ...(await chargerAccueil(sb, c, langue)), defaut: accueilParDefaut(c, langue),
  }))))
  return <EditeurAccueil pages={pages} />
}
