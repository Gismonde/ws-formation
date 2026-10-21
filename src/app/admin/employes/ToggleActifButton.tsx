'use client'

import { useT } from '@/lib/i18n/client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ToggleActifButton({
  id,
  actif,
  nom,
}: {
  id: string
  actif: boolean
  nom: string
}) {
  const { t } = useT()
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleToggle() {
    if (!confirm(actif ? t('Voulez-vous vraiment archiver {nom} ?', { nom }) : t('Voulez-vous vraiment réactiver {nom} ?', { nom }))) return
    setLoading(true)

    const res = await fetch('/api/admin/toggle-employe-actif', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, actif: !actif }),
    })
    const data = await res.json().catch(() => ({}))
    const error = res.ok ? null : { message: data.error ?? 'Erreur inconnue' }

    setLoading(false)
    if (error) {
      alert('Erreur : ' + error.message)
    } else {
      router.refresh()
    }
  }

  const archiveStyle = {
    padding: '5px 12px',
    borderRadius: '6px',
    background: '#fff7ed',
    color: '#ea580c',
    fontSize: '12px',
    fontWeight: '600' as const,
    border: '1px solid #fed7aa',
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.6 : 1,
    fontFamily: 'inherit',
  }

  const reactiveStyle = {
    padding: '5px 12px',
    borderRadius: '6px',
    background: '#f0fdf4',
    color: '#16a34a',
    fontSize: '12px',
    fontWeight: '600' as const,
    border: '1px solid #bbf7d0',
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.6 : 1,
    fontFamily: 'inherit',
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      style={actif ? archiveStyle : reactiveStyle}
    >
      {loading ? '...' : actif ? t('Archiver') : t('Réactiver')}
    </button>
  )
}
