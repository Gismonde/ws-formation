import { redirect } from 'next/navigation'
import { i18n } from '@/lib/i18n/serveur'
import { getActeur, cliniquesAdministrees } from '@/lib/permissions'
import GestionNotifications from './GestionNotifications'

export default async function ParametresPage() {
  const { t } = await i18n()
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (acteur.role !== 'super_admin' && acteur.role !== 'admin') redirect('/admin')
  const cliniques = cliniquesAdministrees(acteur).filter((c): c is 'CMC' | 'WSSC' => c === 'CMC' || c === 'WSSC')
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('Paramètres')}</h1>
          <p className="text-gray-500">{t('Configuration de la plateforme.')}</p>
        </div>
        <GestionNotifications cliniques={cliniques.length ? cliniques : ['CMC']} />
      </div>
    </div>
  )
}
