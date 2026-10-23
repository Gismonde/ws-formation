'use client'
// « Rendre disponible hors ligne » : télécharge les pages et images d'une formation sur l'appareil (tablette).
import { useEffect, useState } from 'react'
import { useT } from '@/lib/i18n/client'

export default function DisponibleHorsLigne({ formationId, titre, urls }: { formationId: string; titre: string; urls: string[] }) {
  const { t } = useT()
  const cle = 'ws_hors_ligne_' + formationId
  const [pret, setPret] = useState(false)
  const [etat, setEtat] = useState<{ fait: number; total: number } | null>(null)
  const [le, setLe] = useState<string | null>(null)

  useEffect(() => {
    setPret('serviceWorker' in navigator && !!navigator.serviceWorker.controller)
    try { setLe(localStorage.getItem(cle)) } catch { /* */ }
  }, [cle])

  if (!pret) return null
  const telecharger = async () => {
    const reg = await navigator.serviceWorker.ready
    const canal = new MessageChannel()
    setEtat({ fait: 0, total: urls.length })
    canal.port1.onmessage = e => {
      const d = e.data as { type: string; fait: number; total: number }
      setEtat({ fait: d.fait, total: d.total })
      if (d.type === 'termine') {
        const maintenant = new Date().toISOString()
        try {
          localStorage.setItem(cle, maintenant)
          const liste = JSON.parse(localStorage.getItem('ws_hors_ligne_liste') ?? '[]') as { id: string; titre: string; le: string }[]
          localStorage.setItem('ws_hors_ligne_liste', JSON.stringify([{ id: formationId, titre, le: maintenant }, ...liste.filter(x => x.id !== formationId)].slice(0, 30)))
        } catch { /* */ }
        setLe(maintenant); setTimeout(() => setEtat(null), 1500)
      }
    }
    reg.active?.postMessage({ type: 'precharger', urls }, [canal.port2])
  }
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
      <button type="button" onClick={telecharger} disabled={!!etat} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-60">
        📥 {etat ? t('Téléchargement… {a}/{b}', { a: etat.fait, b: etat.total }) : le ? t('Mettre à jour la version hors ligne') : t('Rendre disponible hors ligne')}
      </button>
      {le && !etat && <span className="text-xs text-green-700">✓ {t('Disponible hors ligne (vidéos et questionnaire : connexion nécessaire)')}</span>}
    </div>
  )
}
