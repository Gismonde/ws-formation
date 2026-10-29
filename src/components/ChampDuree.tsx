'use client'

import { useT } from '@/lib/i18n/client'

/** Affiche une durée en minutes : « 15 min », « 1 h », « 1 h 30 ». */
export function formatDuree(minutes: number | null | undefined): string {
  const m = Math.max(0, Math.round(Number(minutes) || 0))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60), r = m % 60
  return r ? `${h} h ${String(r).padStart(2, '0')}` : `${h} h`
}

/** Découpe des minutes en heures + minutes (pour le champ). */
export function decouperDuree(minutes: number): { h: number; m: number } {
  const total = Math.max(0, Math.round(Number(minutes) || 0))
  return { h: Math.floor(total / 60), m: total % 60 }
}

/** Champ de durée en heures + minutes ; la valeur est en minutes (au moins 1). */
export default function ChampDuree({ minutes, onChange, className = '' }: { minutes: number; onChange: (minutes: number) => void; className?: string }) {
  const { t } = useT()
  const { h, m } = decouperDuree(minutes)
  const champ = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500'
  const changer = (nh: number, nm: number) => onChange(Math.max(1, Math.min(40 * 60, Math.max(0, nh) * 60 + Math.max(0, nm))))
  return (
    <div className={'flex items-center gap-2 ' + className}>
      <input type="number" min={0} max={40} step={1} value={h} aria-label={t('Heures')}
        onChange={e => changer(Math.floor(Number(e.target.value) || 0), m)} className={champ} />
      <span className="text-sm text-gray-500">h</span>
      <input type="number" min={0} max={59} step={5} value={m} aria-label={t('Minutes')}
        onChange={e => changer(h, Math.min(59, Math.floor(Number(e.target.value) || 0)))} className={champ} />
      <span className="text-sm text-gray-500">min</span>
    </div>
  )
}
