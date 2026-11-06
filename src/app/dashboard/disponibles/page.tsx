import { redirect } from 'next/navigation'
import { getActeur, serviceClient } from '@/lib/permissions'
import { getEspace } from '@/lib/espace'
import { formationsLibres } from '@/lib/formations-libres'
import { i18n } from '@/lib/i18n/serveur'
import BoutonCommencer from './BoutonCommencer'

export default async function FormationsDisponiblesPage() {
  const moi = await getActeur()
  if (!moi) redirect('/login')
  const { t } = await i18n()
  const espace = await getEspace(moi)
  const liste = await formationsLibres(serviceClient(), moi.id, espace.cliniquesContenu as string[])

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1f36', margin: 0 }}>{t('Formations disponibles')}</h1>
        <p style={{ color: '#6b7280', marginTop: '4px', fontSize: '14px' }}>{t('Des formations ouvertes à tous, à suivre si vous le souhaitez : elles ne sont ni assignées ni obligatoires.')}</p>
      </div>
      {liste.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#6b7280' }}>
          <p style={{ fontSize: '32px', margin: '0 0 8px' }}>🧭</p>
          <p style={{ margin: 0 }}>{t('Aucune formation disponible pour le moment.')}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
          {liste.map(f => (
            <div key={f.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ background: 'var(--degrade-clinique)', height: f.image_couverture ? '140px' : '90px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                {f.image_couverture
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={f.image_couverture} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: '32px' }}>📚</span>}
                {f.inscrit && <span style={{ position: 'absolute', top: '8px', right: '8px', background: '#fff', color: '#065f46', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px' }}>✓ {t('Commencée')}</span>}
              </div>
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                <div style={{ flex: 1 }}>
                  {f.categorie && <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '.04em' }}>{f.categorie}</p>}
                  <h3 style={{ fontWeight: 600, color: '#1a1f36', fontSize: '15px', margin: '0 0 6px' }}>{f.titre}</h3>
                  {f.description && <p style={{ color: '#6b7280', fontSize: '13px', margin: 0 }}>{f.description.slice(0, 140)}{f.description.length > 140 ? '…' : ''}</p>}
                </div>
                {f.duree_estimee_minutes ? <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>⏱️ {t('{n} min', { n: f.duree_estimee_minutes })}</p> : null}
                <BoutonCommencer id={f.id} inscrit={f.inscrit} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
