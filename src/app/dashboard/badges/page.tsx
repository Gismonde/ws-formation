import { redirect } from 'next/navigation'
import { getActeur, serviceClient } from '@/lib/permissions'
import { badgesEmploye } from '@/lib/badges'
import GrilleBadges from '@/components/GrilleBadges'
import { i18n } from '@/lib/i18n/serveur'

// « Mes badges » : parcours terminés, paliers de formations, excellence, conformité.
export default async function MesBadgesPage() {
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  const { t, loc } = await i18n()
  const sb = serviceClient()
  const { data: e } = await sb.from('employes').select('id, clinique, role, departement_id, poste').eq('id', acteur.id).single()
  const badges = e ? await badgesEmploye(sb, e) : []
  return (
    <div style={{ maxWidth: '960px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1f36', margin: 0 }}>{t('Mes badges')}</h1>
        <p style={{ color: '#6b7280', marginTop: '4px', fontSize: '14px' }}>{t('Ils s’obtiennent automatiquement en terminant vos formations et vos parcours.')}</p>
      </div>
      <GrilleBadges badges={badges} t={t} loc={loc} />
    </div>
  )
}
