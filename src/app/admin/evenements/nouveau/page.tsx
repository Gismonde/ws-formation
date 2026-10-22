import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActeur, serviceClient, peutCreerEvenements } from '@/lib/permissions'
import { i18n } from '@/lib/i18n/serveur'
import { optionsEvenement } from '@/lib/evenements-admin'
import FormulaireEvenement from '../FormulaireEvenement'

export default async function NouvelEvenementPage() {
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!peutCreerEvenements(acteur)) redirect('/admin')
  const { t } = await i18n()
  const options = await optionsEvenement(serviceClient(), acteur)
  return (
    <div className="max-w-3xl">
      <Link href="/admin/evenements" className="text-sm text-gray-500 hover:text-gray-700">{t('← Événements')}</Link>
      <h1 className="text-2xl font-bold text-gray-900 mt-3 mb-6">{t('Nouvel événement')}</h1>
      <FormulaireEvenement options={options} />
    </div>
  )
}
