'use client'
// Langue des formations : les formations qui existent en français et en anglais sont données dans cette langue.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n/client'

export default function ChoixLangueFormation({ initial }: { initial: 'fr' | 'en' }) {
  const { t } = useT()
  const router = useRouter()
  const [langue, setLangue] = useState(initial)
  const [etat, setEtat] = useState<{ ok: boolean; texte: string } | null>(null)
  const [envoi, setEnvoi] = useState(false)

  const choisir = async (l: 'fr' | 'en') => {
    if (l === langue) return
    setEnvoi(true); setEtat(null)
    try {
      const r = await fetch('/api/profil/langue-formation', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ langue: l }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) setEtat({ ok: false, texte: d.error ?? t('Enregistrement impossible') })
      else {
        setLangue(l)
        setEtat({ ok: true, texte: d.basculees ? t('✓ Langue enregistrée · {n} formation(s) pas encore commencée(s) passée(s) dans cette langue', { n: d.basculees }) : t('✓ Langue enregistrée') })
        router.refresh()
      }
    } catch { setEtat({ ok: false, texte: t('Enregistrement impossible') }) }
    setEnvoi(false)
  }

  return (
    <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '14px 16px' }}>
      <p style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 6px 0' }}>{t('Langue de mes formations')}</p>
      <div style={{ display: 'flex', gap: '6px' }} role="radiogroup" aria-label={t('Langue de mes formations')}>
        {([['fr', 'Français'], ['en', 'English']] as const).map(([l, nom]) => (
          <button key={l} type="button" role="radio" aria-checked={langue === l} onClick={() => choisir(l)} disabled={envoi}
            style={{ padding: '6px 14px', borderRadius: '999px', fontSize: '13px', cursor: 'pointer', border: '1px solid ' + (langue === l ? 'var(--accent-clinique, #4f46e5)' : '#e5e7eb'), background: langue === l ? 'var(--accent-clinique-clair, #eef2ff)' : '#fff', color: '#374151', fontWeight: langue === l ? 600 : 400 }}>
            {nom}
          </button>
        ))}
      </div>
      <p style={{ fontSize: '12px', color: '#6b7280', margin: '8px 0 0' }}>{t('Quand une formation existe en français et en anglais, vous recevez la version dans cette langue. Les formations déjà commencées ne changent pas.')}</p>
      {etat && <p role="status" style={{ fontSize: '12px', margin: '6px 0 0', color: etat.ok ? '#15803d' : '#dc2626' }}>{etat.texte}</p>}
    </div>
  )
}
