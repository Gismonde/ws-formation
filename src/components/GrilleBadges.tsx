// Grille de badges (employé : « Mes badges » ; administrateur : onglet Badges de la fiche employé).
import Link from 'next/link'
import type { Badge, Famille } from '@/lib/badges'
import type { Traducteur } from '@/lib/i18n/base'

const FAMILLES: { id: Famille; titre: string }[] = [
  { id: 'parcours', titre: 'Parcours' },
  { id: 'palier', titre: 'Formations terminées' },
  { id: 'excellence', titre: 'Excellence' },
  { id: 'conformite', titre: 'Conformité' },
]

export function CarteBadge({ b, t, loc }: { b: Badge; t: Traducteur; loc: string }) {
  const pct = b.progression && b.progression.total ? Math.round((b.progression.fait / b.progression.total) * 100) : 0
  const corps = (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '6px', padding: '16px 12px',
      borderRadius: '16px', border: b.obtenu ? '2px solid var(--accent-clinique, #6366f1)' : '1px dashed #d1d5db',
      background: b.obtenu ? '#fff' : '#f9fafb',
    }}>
      <span aria-hidden style={{ fontSize: '36px', lineHeight: 1, filter: b.obtenu ? 'none' : 'grayscale(1)', opacity: b.obtenu ? 1 : 0.45 }}>{b.icone}</span>
      <span style={{ fontWeight: 700, fontSize: '14px', color: b.obtenu ? '#111827' : '#6b7280' }}>{t(b.titre, b.vars)}</span>
      <span style={{ fontSize: '12px', color: '#6b7280', lineHeight: 1.4 }}>{t(b.description)}</span>
      {b.obtenu ? (
        <span style={{ marginTop: 'auto', fontSize: '11px', fontWeight: 700, color: '#16a34a' }}>
          ✓ {b.le ? t('Obtenu le {date}', { date: new Date(b.le).toLocaleDateString(loc, { dateStyle: 'medium' }) }) : t('Obtenu')}
        </span>
      ) : b.progression ? (
        <span style={{ marginTop: 'auto', width: '100%' }}>
          <span style={{ display: 'block', height: '6px', borderRadius: '99px', background: '#e5e7eb', overflow: 'hidden' }}>
            <span style={{ display: 'block', width: pct + '%', height: '100%', background: 'var(--accent-clinique, #6366f1)' }} />
          </span>
          <span style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>{b.progression.fait}/{b.progression.total}</span>
        </span>
      ) : (
        <span style={{ marginTop: 'auto', fontSize: '11px', color: '#9ca3af' }}>{t('À obtenir')}</span>
      )}
    </div>
  )
  return b.lien ? <Link href={b.lien} style={{ textDecoration: 'none' }}>{corps}</Link> : corps
}

export default function GrilleBadges({ badges, t, loc, liens = true }: { badges: Badge[]; t: Traducteur; loc: string; liens?: boolean }) {
  const obtenus = badges.filter(b => b.obtenu).length
  return (
    <div>
      <p style={{ fontSize: '14px', color: '#374151', margin: '0 0 16px' }}>
        <strong style={{ fontSize: '20px', color: 'var(--accent-clinique, #4f46e5)' }}>{obtenus}</strong> / {badges.length} {t('badge(s) obtenu(s)')}
      </p>
      {FAMILLES.map(f => {
        const liste = badges.filter(b => b.famille === f.id)
        if (!liste.length) return null
        return (
          <section key={f.id} style={{ marginBottom: '22px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 10px' }}>{t(f.titre)}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
              {liste.map(b => <CarteBadge key={b.id} b={liens ? b : { ...b, lien: undefined }} t={t} loc={loc} />)}
            </div>
          </section>
        )
      })}
    </div>
  )
}
