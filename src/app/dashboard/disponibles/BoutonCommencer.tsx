'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n/client'

type Statut = 'en_attente' | 'acceptee' | 'refusee' | null

/** « Commencer » (accès libre) ou « Demander l'accès » (sur demande), puis suivi de la demande. */
export default function BoutonCommencer({ id, mode, inscrit, demande, motif }: { id: string; mode: 'libre' | 'demande'; inscrit: boolean; demande: Statut; motif: string | null }) {
  const { t } = useT()
  const router = useRouter()
  const [envoi, setEnvoi] = useState(false)
  const [statut, setStatut] = useState<Statut>(demande)
  const [ouvert, setOuvert] = useState(false)
  const [message, setMessage] = useState('')
  const [erreur, setErreur] = useState('')
  const bouton = (actif = true) => ({ width: '100%', padding: '10px 14px', borderRadius: '10px', border: 'none', background: actif ? 'var(--accent-clinique)' : '#e5e7eb', color: actif ? '#fff' : '#6b7280', fontWeight: 600, fontSize: '14px', cursor: envoi ? 'wait' : actif ? 'pointer' : 'default', opacity: envoi ? 0.7 : 1 })

  async function envoyer() {
    setEnvoi(true); setErreur('')
    const r = await fetch(`/api/formations/${id}/inscription-libre`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) })
    const d = await r.json().catch(() => ({}))
    setEnvoi(false)
    if (!r.ok) { setErreur(t('Impossible de commencer cette formation.')); return }
    if (d.statut === 'inscrit') { router.push('/formations/' + id); return }
    setStatut('en_attente'); setOuvert(false)
  }

  if (inscrit) return <button type="button" onClick={() => router.push('/formations/' + id)} style={bouton()}>{t('Continuer')}</button>
  if (mode === 'libre') return (
    <div>
      <button type="button" onClick={envoyer} disabled={envoi} style={bouton()}>{envoi ? '…' : t('Commencer')}</button>
      {erreur && <p style={{ color: '#dc2626', fontSize: '12px', margin: '6px 0 0' }}>{erreur}</p>}
    </div>
  )
  if (statut === 'en_attente') return <div style={{ ...bouton(false), textAlign: 'center' }}>⏳ {t('Demande envoyée — en attente de réponse')}</div>
  return (
    <div>
      {statut === 'refusee' && (
        <p style={{ fontSize: '12px', color: '#991b1b', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '6px 8px', margin: '0 0 8px' }}>
          {t('Votre demande précédente a été refusée.')}{motif ? ` ${t('Motif : {m}', { m: motif })}` : ''}
        </p>
      )}
      {ouvert ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={500} rows={3} placeholder={t('Pourquoi souhaitez-vous suivre cette formation ? (facultatif)')}
            style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '8px', fontSize: '13px', resize: 'vertical' }} />
          <button type="button" onClick={envoyer} disabled={envoi} style={bouton()}>{envoi ? '…' : t('Envoyer la demande')}</button>
        </div>
      ) : (
        <button type="button" onClick={() => setOuvert(true)} style={bouton()}>📩 {statut === 'refusee' ? t('Demander à nouveau') : t('Demander l’accès')}</button>
      )}
      {erreur && <p style={{ color: '#dc2626', fontSize: '12px', margin: '6px 0 0' }}>{erreur}</p>}
    </div>
  )
}
