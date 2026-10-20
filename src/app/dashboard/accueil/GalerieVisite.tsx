'use client'

import { useEffect, useState } from 'react'
import type { PhotoAccueil } from '@/lib/accueil'
import { useT } from '@/lib/i18n/client'

/** Galerie de la visite virtuelle, avec agrandissement (flèches du clavier et Échap). */
export default function GalerieVisite({ photos }: { photos: PhotoAccueil[] }) {
  const [ouverte, setOuverte] = useState<number | null>(null)
  const { t } = useT()

  useEffect(() => {
    if (ouverte === null) return
    const clavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOuverte(null)
      if (e.key === 'ArrowRight') setOuverte(i => (i === null ? i : (i + 1) % photos.length))
      if (e.key === 'ArrowLeft') setOuverte(i => (i === null ? i : (i - 1 + photos.length) % photos.length))
    }
    window.addEventListener('keydown', clavier)
    return () => window.removeEventListener('keydown', clavier)
  }, [ouverte, photos.length])

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
        {photos.map((p, i) => (
          <button key={p.url + i} type="button" onClick={() => setOuverte(i)} aria-label={p.legende || t('Photo {n}', { n: i + 1 })}
            style={{ position: 'relative', border: 'none', padding: 0, borderRadius: '12px', overflow: 'hidden', cursor: 'zoom-in', aspectRatio: '4 / 3', background: 'var(--accent-clinique-clair)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.legende} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            {p.legende && (
              <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '18px 10px 8px', fontSize: '12px', fontWeight: 600, color: '#fff', textAlign: 'left', background: 'linear-gradient(transparent, rgba(0,0,0,0.65))' }}>{p.legende}</span>
            )}
          </button>
        ))}
      </div>
      {ouverte !== null && (
        <div role="dialog" aria-modal="true" onClick={() => setOuverte(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[ouverte].url} alt={photos[ouverte].legende} style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: '8px' }} onClick={e => e.stopPropagation()} />
          {photos[ouverte].legende && <p style={{ position: 'absolute', bottom: '18px', color: '#fff', fontSize: '14px', margin: 0 }}>{photos[ouverte].legende}</p>}
          {photos.length > 1 && <>
            <button type="button" aria-label={t('Photo précédente')} onClick={e => { e.stopPropagation(); setOuverte((ouverte - 1 + photos.length) % photos.length) }} style={fleche('left')}>‹</button>
            <button type="button" aria-label={t('Photo suivante')} onClick={e => { e.stopPropagation(); setOuverte((ouverte + 1) % photos.length) }} style={fleche('right')}>›</button>
          </>}
          <button type="button" aria-label={t('Fermer')} onClick={() => setOuverte(null)} style={{ position: 'absolute', top: '12px', right: '16px', background: 'none', border: 'none', color: '#fff', fontSize: '32px', cursor: 'pointer' }}>×</button>
        </div>
      )}
    </>
  )
}

const fleche = (cote: 'left' | 'right'): React.CSSProperties => ({
  position: 'absolute', [cote]: '12px', top: '50%', transform: 'translateY(-50%)', width: '44px', height: '44px', borderRadius: '50%',
  border: 'none', background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: '28px', cursor: 'pointer',
})
