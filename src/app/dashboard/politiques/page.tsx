import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActeur, serviceClient } from '@/lib/permissions'
import { politiquesDeLEmploye } from '@/lib/politiques'
import { getEspace } from '@/lib/espace'
import { i18n } from '@/lib/i18n/serveur'

export default async function MesPolitiquesPage() {
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  const espace = await getEspace(acteur)
  const { t, loc } = await i18n()
  const politiques = await politiquesDeLEmploye(serviceClient(), acteur, espace.actif)
  const enAttente = politiques.filter(p => !p.confirme_le)
  const confirmees = politiques.filter(p => p.confirme_le)

  const carte = (p: (typeof politiques)[number]) => (
    <Link key={p.id} href={`/dashboard/politiques/${p.id}`}
      style={{ display: 'block', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px 20px', textDecoration: 'none', color: 'inherit' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '22px' }}>📜</span>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <div style={{ fontWeight: 600, color: '#111827' }}>{p.titre}</div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
            {t('Version {version}', { version: p.version })} · {new Date(p.publiee_le).toLocaleDateString(loc, { dateStyle: 'medium' })}
          </div>
        </div>
        {p.confirme_le ? (
          <span style={{ fontSize: '12px', fontWeight: 600, background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: '999px' }}>
            ✅ {t('Lu et compris le {date}', { date: new Date(p.confirme_le).toLocaleDateString(loc, { dateStyle: 'medium' }) })}
          </span>
        ) : (
          <span style={{ fontSize: '12px', fontWeight: 600, background: '#fef3c7', color: '#92400e', padding: '4px 10px', borderRadius: '999px' }}>
            {p.a_reconfirmer ? `🔄 ${t('Mise à jour à confirmer')}` : `⏳ ${t('À lire et confirmer')}`}
          </span>
        )}
      </div>
    </Link>
  )

  return (
    <div style={{ maxWidth: '820px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', margin: 0 }}>{t('Politiques de la clinique')}</h1>
      <p style={{ color: '#6b7280', fontSize: '14px', margin: '4px 0 24px' }}>
        {t('Lisez chaque politique puis confirmez « J’ai lu et compris ». Lorsqu’une politique est mise à jour, une nouvelle confirmation est demandée.')}
      </p>

      {politiques.length === 0 && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>
          {t('Aucune politique à consulter pour le moment.')}
        </div>
      )}

      {enAttente.length > 0 && (
        <section style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#92400e', margin: '0 0 10px' }}>{t('À confirmer ({n})', { n: enAttente.length })}</h2>
          <div style={{ display: 'grid', gap: '10px' }}>{enAttente.map(carte)}</div>
        </section>
      )}
      {confirmees.length > 0 && (
        <section>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#374151', margin: '0 0 10px' }}>{t('Déjà confirmées ({n})', { n: confirmees.length })}</h2>
          <div style={{ display: 'grid', gap: '10px' }}>{confirmees.map(carte)}</div>
        </section>
      )}
    </div>
  )
}
