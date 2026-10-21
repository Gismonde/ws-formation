import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActeur } from '@/lib/permissions'
import { aAccesAdmin } from '@/lib/cliniques'
import { i18n } from '@/lib/i18n/serveur'
import ImportEmployes from './ImportEmployes'

export default async function ImporterEmployesPage() {
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!aAccesAdmin(acteur.role)) redirect('/dashboard/accueil')
  if (acteur.role === 'gestionnaire' && (!acteur.departement_id || !acteur.clinique)) redirect('/admin/employes')
  const { t } = await i18n()
  return (
    <div className="max-w-5xl">
      <Link href="/admin/employes" className="text-sm text-gray-500 hover:text-gray-700">{t('← Retour aux employés')}</Link>
      <h1 className="text-2xl font-bold text-gray-900 mt-3">{t('Importer des employés')}</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">{t('Créez plusieurs comptes d’un coup à partir d’un fichier Excel (.xlsx) ou CSV. Chaque employé reçoit un courriel d’invitation pour créer son mot de passe.')}</p>
      <ImportEmployes estGestionnaire={acteur.role === 'gestionnaire'} />
    </div>
  )
}
