import { redirect } from 'next/navigation'
import { i18n } from '@/lib/i18n/serveur'
import { getActeur, serviceClient } from '@/lib/permissions'
import { estAdminCommunications, peutGererCommunication, type Communication } from '@/lib/communications'
import { cliniquesDe } from '@/lib/cliniques'
import CommunicationsAdmin from './CommunicationsAdmin'

export const dynamic = 'force-dynamic'

// Administration → Affiches & communications : dépôt (PDF ou image), publication, courriel facultatif.
export default async function CommunicationsAdminPage() {
  const { t } = await i18n()
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!estAdminCommunications(acteur)) redirect('/admin')
  const { data, error } = await serviceClient().from('communications').select('*').order('cree_le', { ascending: false })
  const vue = acteur.vue ?? null
  const liste = ((data ?? []) as Communication[]).filter(c => peutGererCommunication(acteur, c.clinique) && (!vue || c.clinique === vue || c.clinique === 'LES_DEUX'))
  const cliniques = acteur.role === 'super_admin' || acteur.clinique === 'LES_DEUX' ? ['WSSC', 'CMC', 'LES_DEUX'] : cliniquesDe(acteur.clinique)
  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900">{t('Affiches & communications')}</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6 max-w-3xl">{t('Déposez une affiche ou une communication (PDF ou image). Une fois publiée, elle apparaît pour les employés de la clinique dans Politiques & procédures → Affiches & communications.')}</p>
      {error && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 mb-4">{t('Exécutez d’abord')} <code>supabase/migrations/communications.sql</code> {t('dans Supabase.')}</div>}
      <CommunicationsAdmin communications={liste} cliniques={cliniques} cliniqueDefaut={vue ?? (cliniques.length === 1 ? cliniques[0] : 'WSSC')} />
    </div>
  )
}
