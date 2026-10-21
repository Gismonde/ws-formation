'use client'

import { useT } from '@/lib/i18n/client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CLINIQUE_INFO, type Clinique } from '@/lib/cliniques'

/** Sélecteur de vue de l'espace Admin : CMC, WSSC ou les deux cliniques. */
export function ChoixVueAdmin({ vue, possibles }: { vue: Clinique | null; possibles: Clinique[] }) {
  const router = useRouter()
  const { t } = useT()
  const [enCours, setEnCours] = useState<string | null>(null)
  if (possibles.length < 2) return null
  const options: { v: Clinique | 'TOUS'; l: string }[] = [...possibles.map(c => ({ v: c, l: CLINIQUE_INFO[c].court })), { v: 'TOUS', l: t('Les deux') }]

  async function choisir(v: Clinique | 'TOUS') {
    if ((v === 'TOUS' ? null : v) === vue || enCours) return
    setEnCours(v)
    try {
      const r = await fetch('/api/espace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vue: v }) })
      if (r.ok) router.refresh()
    } finally { setEnCours(null) }
  }

  return (
    <div style={{ marginTop: '14px' }}>
      <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.6px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>{t('Clinique affichée')}</div>
      <div role="group" aria-label={t('Choisir la clinique affichée')} style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', padding: '4px' }}>
        {options.map(o => {
          const actif = (o.v === 'TOUS' ? null : o.v) === vue
          return (
            <button key={o.v} type="button" onClick={() => choisir(o.v)} aria-pressed={actif} disabled={enCours !== null}
              style={{
                flex: 1, border: 'none', borderRadius: '7px', padding: '6px 4px', cursor: actif ? 'default' : 'pointer', fontSize: '12px', fontWeight: 700,
                background: actif ? '#fff' : 'transparent',
                color: actif ? (o.v === 'TOUS' ? '#1f2937' : CLINIQUE_INFO[o.v].couleur) : 'rgba(255,255,255,0.8)',
              }}>
              {enCours === o.v ? '…' : o.l}
            </button>
          )
        })}
      </div>
    </div>
  )
}
