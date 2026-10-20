'use client'
// Bascule français / anglais de l'interface (mémorisée un an dans le navigateur).
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { LANGUE_COOKIE, type Langue } from '@/lib/i18n/base'
import { useLangue } from '@/lib/i18n/client'

export function ChoixLangue({ sombre = false }: { sombre?: boolean }) {
  const actuelle = useLangue()
  const router = useRouter()
  const [enCours, demarrer] = useTransition()

  function choisir(l: Langue) {
    if (l === actuelle) return
    document.cookie = `${LANGUE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`
    document.documentElement.lang = l
    demarrer(() => router.refresh())
  }

  const couleur = sombre ? 'rgba(255,255,255,0.8)' : '#4b5563'
  return (
    <div role="group" aria-label="Langue / Language" style={{ display: 'inline-flex', gap: '2px', borderRadius: '8px', padding: '2px', background: sombre ? 'rgba(255,255,255,0.1)' : '#f3f4f6', opacity: enCours ? 0.6 : 1 }}>
      {(['fr', 'en'] as const).map(l => (
        <button key={l} type="button" onClick={() => choisir(l)} aria-pressed={l === actuelle} lang={l}
          title={l === 'fr' ? 'Français' : 'English'}
          style={{
            border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', fontWeight: 700, cursor: l === actuelle ? 'default' : 'pointer',
            background: l === actuelle ? '#fff' : 'transparent', color: l === actuelle ? '#111827' : couleur,
          }}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
