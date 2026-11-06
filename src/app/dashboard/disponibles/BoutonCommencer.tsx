'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n/client'

/** Inscription volontaire puis ouverture de la formation. */
export default function BoutonCommencer({ id, inscrit }: { id: string; inscrit: boolean }) {
  const { t } = useT()
  const router = useRouter()
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState('')
  async function commencer() {
    if (inscrit) { router.push('/formations/' + id); return }
    setEnvoi(true); setErreur('')
    const r = await fetch(`/api/formations/${id}/inscription-libre`, { method: 'POST' })
    if (!r.ok) { setErreur(t('Impossible de commencer cette formation.')); setEnvoi(false); return }
    router.push('/formations/' + id)
  }
  return (
    <div>
      <button type="button" onClick={commencer} disabled={envoi}
        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: 'none', background: 'var(--accent-clinique)', color: '#fff', fontWeight: 600, fontSize: '14px', cursor: envoi ? 'wait' : 'pointer', opacity: envoi ? 0.7 : 1 }}>
        {envoi ? '…' : inscrit ? t('Continuer') : t('Commencer')}
      </button>
      {erreur && <p style={{ color: '#dc2626', fontSize: '12px', margin: '6px 0 0' }}>{erreur}</p>}
    </div>
  )
}
