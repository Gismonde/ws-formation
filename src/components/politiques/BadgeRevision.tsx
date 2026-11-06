import { joursAvantRevision, ALERTE_REVISION_JOURS } from '@/lib/politiques'

/** Date de révision d'une politique : gris (plus tard), orange (≤ 30 jours), rouge (dépassée). */
export default function BadgeRevision({ p, t, loc, compact }: { p: { date_revision?: string | null }; t: (c: string, v?: Record<string, string | number>) => string; loc: string; compact?: boolean }) {
  const j = joursAvantRevision(p)
  if (j === null) return null
  const date = new Date(p.date_revision + 'T12:00:00').toLocaleDateString(loc, { dateStyle: compact ? 'medium' : 'long' })
  const cls = j < 0 ? 'bg-red-50 text-red-700 border-red-200' : j <= ALERTE_REVISION_JOURS ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-gray-50 text-gray-600 border-gray-200'
  const texte = j < 0 ? t('À réviser depuis le {date}', { date }) : j <= ALERTE_REVISION_JOURS ? t('Révision le {date} (dans {n} j)', { date, n: j }) : t('Révision le {date}', { date })
  return <span className={`inline-block border rounded-full px-2 py-0.5 text-xs font-medium ${compact ? '' : 'mt-2'} ${cls}`}>📅 {texte}</span>
}
