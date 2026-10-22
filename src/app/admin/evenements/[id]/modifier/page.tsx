import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getActeur, serviceClient } from '@/lib/permissions'
import { i18n } from '@/lib/i18n/serveur'
import { chargerEvenement } from '@/lib/evenements'
import { estPourToute } from '@/lib/politiques'
import { optionsEvenement, peutGererEvenement } from '@/lib/evenements-admin'
import FormulaireEvenement from '../../FormulaireEvenement'

export default async function ModifierEvenementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  const sb = serviceClient()
  const d = await chargerEvenement(sb, id)
  if (!d || !peutGererEvenement(acteur, d.ev)) notFound()
  const { t } = await i18n()
  const ev = d.ev
  return (
    <div className="max-w-3xl">
      <Link href={`/admin/evenements/${id}`} className="text-sm text-gray-500 hover:text-gray-700">{t('← Retour à l’événement')}</Link>
      <h1 className="text-2xl font-bold text-gray-900 mt-3 mb-6">{t('Modifier l’événement')}</h1>
      <FormulaireEvenement options={await optionsEvenement(sb, acteur)} evenementId={id} initial={{
        titre: ev.titre, description: ev.description ?? '', image: ev.image ?? '', lieu: ev.lieu ?? '', responsable: ev.responsable ?? '',
        obligatoire: ev.obligatoire, desinscription_heures: ev.desinscription_heures, formation_id: ev.formation_id ?? '', duree_minutes: ev.duree_minutes ? String(ev.duree_minutes) : '',
        ciblage: { clinique: ev.clinique, tous: estPourToute(ev), departements: ev.departements ?? [], employes: ev.employes ?? [], roles: ev.roles ?? [], postes: ev.postes ?? [] },
      }} />
    </div>
  )
}
