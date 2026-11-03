'use client'
// Compte à rebours de la bannière « en vedette » (jours, heures, minutes).
import { useEffect, useState } from 'react'
import { useT } from '@/lib/i18n/client'

export default function CompteARebours({ date, couleur }: { date: string; couleur: string }) {
  const { t } = useT()
  const [maintenant, setMaintenant] = useState<number | null>(null)
  useEffect(() => {
    setMaintenant(Date.now())
    const id = setInterval(() => setMaintenant(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])
  const reste = Math.max(0, Date.parse(date) - (maintenant ?? Date.parse(date)))
  const j = Math.floor(reste / 86_400_000), h = Math.floor((reste % 86_400_000) / 3_600_000), m = Math.floor((reste % 3_600_000) / 60_000)
  const bloc = (n: number, l: string) => (
    <div className="w-[78px] rounded-2xl bg-white/95 py-2.5 text-center shadow-sm">
      <b className="block text-3xl font-extrabold leading-none tabular-nums" style={{ color: couleur }}>{maintenant === null ? '–' : String(n).padStart(2, '0')}</b>
      <small className="text-[11px] font-bold text-gray-500">{l}</small>
    </div>
  )
  return (
    <div className="flex justify-center gap-2.5" aria-label={t('Temps restant')}>
      {bloc(j, t('jours'))}{bloc(h, t('heures'))}{bloc(m, t('min'))}
    </div>
  )
}
