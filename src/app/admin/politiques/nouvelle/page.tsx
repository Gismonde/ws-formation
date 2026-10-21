import { i18n } from '@/lib/i18n/serveur'
import { redirect } from 'next/navigation'
import { getActeur, serviceClient } from '@/lib/permissions'
import { cliniquesPolitiquePossibles, peutPublierPolitiques } from '@/lib/politiques'
import { courrielsActifs } from '@/lib/courriels'
import FormulairePolitique from './FormulairePolitique'

export default async function NouvellePolitiquePage() {
  const { t } = await i18n()
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!peutPublierPolitiques(acteur)) redirect('/admin/politiques')
  const { data: departements } = await serviceClient().from('departements').select('id, nom').order('nom')

  return (
    <div className="max-w-3xl">
      <a href="/admin/politiques" className="text-sm text-indigo-600 hover:underline">{t('← Politiques')}</a>
      <h1 className="text-2xl font-bold text-gray-900 mt-2">{t('Nouvelle politique')}</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">
        {t('Les employés visés la verront dans leur portail et devront confirmer « J’ai lu et compris ».')}
      </p>
      <FormulairePolitique
        cliniques={cliniquesPolitiquePossibles(acteur)}
        departements={departements ?? []}
        courrielsActifs={courrielsActifs()}
      />
    </div>
  )
}
