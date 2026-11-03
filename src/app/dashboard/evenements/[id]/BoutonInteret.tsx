'use client'
// Événement « date à venir » : l'employé demande à être prévenu quand la date sera annoncée.
import { useState } from 'react'
import { useT } from '@/lib/i18n/client'

export default function BoutonInteret({ evenementId, interesse }: { evenementId: string; interesse: boolean }) {
  const { t } = useT()
  const [oui, setOui] = useState(interesse)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  async function basculer() {
    setEnvoi(true); setErreur(null)
    const r = await fetch(`/api/evenements/${evenementId}/interet`, { method: oui ? 'DELETE' : 'POST' })
    setEnvoi(false)
    if (r.ok) setOui(!oui); else setErreur(t('Erreur'))
  }
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '20px 24px', marginTop: '16px' }}>
      <div style={{ fontWeight: 700, color: '#111827' }}>📅 {t('Date à venir')}</div>
      <p style={{ fontSize: '14px', color: '#4b5563', margin: '6px 0 14px' }}>{t('La date de cet événement n’est pas encore fixée. Demandez à être prévenu(e) : vous recevrez un courriel dès qu’elle sera annoncée.')}</p>
      <button type="button" onClick={basculer} disabled={envoi}
        style={{ padding: '10px 18px', borderRadius: '10px', fontWeight: 700, fontSize: '14px', border: oui ? '1px solid #d1d5db' : 'none', background: oui ? '#fff' : 'var(--accent-clinique, #4f46e5)', color: oui ? '#374151' : '#fff', cursor: 'pointer' }}>
        {oui ? `✓ ${t('Vous serez prévenu(e) — ne plus me prévenir')}` : `🔔 ${t('Me prévenir quand la date sera annoncée')}`}
      </button>
      {erreur && <p style={{ color: '#dc2626', fontSize: '13px', marginTop: '8px' }}>{erreur}</p>}
    </div>
  )
}
