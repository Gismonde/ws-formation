import { redirect } from 'next/navigation'
import { getActeur } from '@/lib/permissions'
import { estAdministrateur } from '@/lib/cliniques'
import { i18n } from '@/lib/i18n/serveur'
import GestionPostes from './GestionPostes'

export default async function PostesPage() {
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!estAdministrateur(acteur.role)) redirect('/admin')
  const { t } = await i18n()
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900">{t('Postes')}</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">{t('Liste officielle des postes, utilisée dans les fiches employés, l’import et le ciblage des politiques et des événements.')}</p>
      <GestionPostes />
    </div>
  )
}
