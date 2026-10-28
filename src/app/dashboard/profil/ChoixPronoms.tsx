'use client'
// Pronoms facultatifs : la personne choisit une proposition, écrit les siens, ou n'indique rien.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n/client'
import { PRONOMS_PROPOSES } from '@/lib/pronoms'

export default function ChoixPronoms({ initial }: { initial: string | null }) {
  const { t } = useT()
  const router = useRouter()
  const [valeur, setValeur] = useState(initial ?? '')
  const [etat, setEtat] = useState<{ ok: boolean; texte: string } | null>(null)
  const [envoi, setEnvoi] = useState(false)

  const enregistrer = async (v: string) => {
    setEnvoi(true); setEtat(null)
    try {
      const r = await fetch('/api/profil/pronoms', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pronoms: v }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) setEtat({ ok: false, texte: d.error ?? t('Enregistrement impossible') })
      else { setValeur(d.pronoms ?? ''); setEtat({ ok: true, texte: d.pronoms ? t('✓ Pronoms enregistrés') : t('✓ Pronoms retirés') }); router.refresh() }
    } catch { setEtat({ ok: false, texte: t('Enregistrement impossible') }) }
    setEnvoi(false)
  }

  return (
    <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '14px 16px' }}>
      <p style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 6px 0' }}>{t('Pronoms (facultatif)')}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
        {PRONOMS_PROPOSES.map(p => (
          <button key={p} type="button" onClick={() => setValeur(p)} disabled={envoi}
            style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '12px', cursor: 'pointer', border: '1px solid ' + (valeur === p ? 'var(--accent-clinique, #4f46e5)' : '#e5e7eb'), background: valeur === p ? 'var(--accent-clinique-clair, #eef2ff)' : '#fff', color: '#374151' }}>
            {p}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <input value={valeur} onChange={e => setValeur(e.target.value)} maxLength={40} placeholder={t('Ou écrivez les vôtres')} aria-label={t('Pronoms (facultatif)')}
          style={{ flex: '1 1 160px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '6px 10px', fontSize: '14px' }} />
        <button type="button" onClick={() => enregistrer(valeur)} disabled={envoi}
          style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', background: 'var(--accent-clinique, #4f46e5)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
          {envoi ? t('Enregistrement...') : t('Enregistrer')}
        </button>
        {initial && (
          <button type="button" onClick={() => enregistrer('')} disabled={envoi}
            style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: '13px', cursor: 'pointer' }}>
            {t('Ne pas indiquer')}
          </button>
        )}
      </div>
      <p style={{ fontSize: '12px', color: '#6b7280', margin: '8px 0 0' }}>{t('Visibles à côté de votre nom par les personnes qui gèrent votre dossier. Vous pouvez les changer ou les retirer à tout moment.')}</p>
      {etat && <p role="status" style={{ fontSize: '12px', margin: '6px 0 0', color: etat.ok ? '#15803d' : '#dc2626' }}>{etat.texte}</p>}
    </div>
  )
}
