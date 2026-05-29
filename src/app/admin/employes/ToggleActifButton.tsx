'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  id: string
  actif: boolean
  nom: string
}

export default function ToggleActifButton({ id, actif, nom }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleToggle = async () => {
    const action = actif ? 'archiver' : 'réactiver'
    const confirm = window.confirm(
      actif
        ? `Archiver ${nom} ? Cet employé ne pourra plus se connecter à la plateforme.`
        : `Réactiver ${nom} ? Cet employé pourra à nouveau accéder à la plateforme.`
    )
    if (!confirm) return

    setLoading(true)
    try {
      const res = await fetch('/api/admin/toggle-employe-actif', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, actif: !actif }),
      })

      if (!res.ok) {
        const data = await res.json()
        alert('Erreur : ' + (data.error || 'Une erreur est survenue'))
      } else {
        router.refresh()
      }
    } catch (err) {
      alert('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={
        actif
          ? 'text-sm font-medium border px-3 py-1 rounded-lg transition-colors text-orange-600 hover:text-orange-800 border-orange-200 hover:bg-orange-50 disabled:opacity-50'
          : 'text-sm font-medium border px-3 py-1 rounded-lg transition-colors text-green-600 hover:text-green-800 border-green-200 hover:bg-green-50 disabled:opacity-50'
      }
    >
      {loading ? '...' : actif ? 'Archiver' : 'Réactiver'}
    </button>
  )
}
