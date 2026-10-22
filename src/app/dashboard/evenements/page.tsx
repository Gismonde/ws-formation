// Portail employé : événements de formation en présentiel qui me concernent.
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActeur, serviceClient } from '@/lib/permissions'
import { evenementsDeLEmploye, seanceOuverte } from '@/lib/evenements'
import { i18n } from '@/lib/i18n/serveur'

export const dynamic = 'force-dynamic'

export default async function MesEvenementsPage() {
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  const { t, loc } = await i18n()
  const liste = await evenementsDeLEmploye(serviceClient(), acteur)
  const aVenir = liste.filter(x => !x.termine).sort((a, b) => (a.prochaine ?? '9').localeCompare(b.prochaine ?? '9'))
  const passes = liste.filter(x => x.termine)
  const date = (d: string) => new Date(d).toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' })

  const Carte = ({ x }: { x: (typeof liste)[number] }) => {
    const ma = x.mienne && x.seances.find(s => s.id === x.mienne!.seance_id)
    const ouvertes = x.seances.filter(s => seanceOuverte(s))
    const placesLibres = ouvertes.some(s => s.restantes > 0)
    return (
      <Link href={`/dashboard/evenements/${x.ev.id}`} style={{ display: 'flex', flexDirection: 'column', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '14px', overflow: 'hidden', textDecoration: 'none', color: 'inherit' }}>
        {x.ev.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={x.ev.image} alt="" style={{ width: '100%', height: '140px', objectFit: 'cover' }} />
          : <div style={{ height: '100px', background: 'var(--accent-clinique-fond, #eef2ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px' }}>📅</div>}
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {x.ev.obligatoire && <span style={{ fontSize: '11px', fontWeight: 700, background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '999px' }}>{t('Obligatoire')}</span>}
            {x.mienne?.statut === 'inscrit' && <span style={{ fontSize: '11px', fontWeight: 700, background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '999px' }}>✓ {t('Inscrit(e)')}</span>}
            {x.mienne?.statut === 'attente' && <span style={{ fontSize: '11px', fontWeight: 700, background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: '999px' }}>{t('Liste d’attente')}</span>}
            {x.mienne?.present === true && <span style={{ fontSize: '11px', fontWeight: 700, background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '999px' }}>✓ {t('Présent(e)')}</span>}
          </div>
          <div style={{ fontWeight: 600, color: '#111827' }}>{x.ev.titre}</div>
          <div style={{ fontSize: '13px', color: '#6b7280' }}>
            {ma ? t('Ma séance : {date}', { date: date(ma.debut) })
              : x.termine ? t('Terminé')
                : ouvertes.length ? (placesLibres ? t('{n} date(s) proposée(s)', { n: ouvertes.length }) : t('Complet — liste d’attente possible'))
                  : t('Inscriptions fermées')}
          </div>
        </div>
      </Link>
    )
  }

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', margin: 0 }}>{t('Événements')}</h1>
      <p style={{ color: '#6b7280', fontSize: '14px', margin: '6px 0 24px' }}>{t('Formations en présentiel qui vous sont proposées : choisissez une date et inscrivez-vous.')}</p>
      {liste.length === 0 && <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '32px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>{t('Aucun événement pour le moment.')}</div>}
      {aVenir.length > 0 && <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>{aVenir.map(x => <Carte key={x.ev.id} x={x} />)}</div>}
      {passes.length > 0 && (
        <>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#374151', margin: '32px 0 12px' }}>{t('Événements passés')}</h2>
          <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', opacity: 0.8 }}>{passes.map(x => <Carte key={x.ev.id} x={x} />)}</div>
        </>
      )}
    </div>
  )
}
