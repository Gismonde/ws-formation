import { redirect } from 'next/navigation'
import { getActeur } from '@/lib/permissions'
import { estAdministrateur } from '@/lib/cliniques'
import { i18n } from '@/lib/i18n/serveur'
import DepotMedias from './DepotMedias'

/** Téléversement rapide d'images ou d'animations (GIF) pour les leçons : glisser-déposer, puis copier le lien. */
export default async function MediasPage() {
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!estAdministrateur(acteur.role)) redirect('/admin')
  const { t } = await i18n()
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900">{t('Médias')}</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">{t('Déposez une image ou une animation GIF : elle est mise en ligne et son lien peut être utilisé dans une leçon.')}</p>
      <DepotMedias />
    </div>
  )
}
