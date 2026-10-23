import { redirect } from 'next/navigation'
import { getActeur, serviceClient, cliniquesContenuVisibles, cliniquesContenuGerables } from '@/lib/permissions'
import { estAdministrateur } from '@/lib/cliniques'
import { chargerConfigBadges, BADGES_INTEGRES } from '@/lib/badges'
import BadgesAdmin from './BadgesAdmin'
import { i18n } from '@/lib/i18n/serveur'

export default async function BadgesAdminPage() {
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!estAdministrateur(acteur.role)) redirect('/admin')
  const { t } = await i18n()
  const sb = serviceClient()
  const [config, { data: formations }, { error }] = await Promise.all([
    chargerConfigBadges(sb),
    sb.from('formations').select('id, titre, clinique').is('copie_de', null).in('clinique', cliniquesContenuVisibles(acteur)).order('titre'),
    sb.from('badges_perso').select('id', { head: true, count: 'exact' }),
  ])
  const gerables = cliniquesContenuGerables(acteur)
  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900">🏅 {t('Badges')}</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">{t('Les badges sont remis automatiquement aux employés. Réglez les badges intégrés et créez ceux de votre clinique.')}</p>
      {error ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{t('Exécutez d’abord')} <code>supabase/migrations/badges_admin.sql</code> {t('dans Supabase.')}</p> : (
        <BadgesAdmin
          integres={BADGES_INTEGRES} reglages={config.reglages} perso={config.perso.filter(p => cliniquesContenuVisibles(acteur).includes(p.clinique as never))}
          formations={(formations ?? []) as { id: string; titre: string; clinique: string }[]}
          peutReglerIntegres={acteur.role === 'super_admin'} cliniques={gerables}
        />
      )}
    </div>
  )
}
