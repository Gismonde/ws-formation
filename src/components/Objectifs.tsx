'use client'
// Objectifs d'apprentissage d'une formation (formations.objectifs, liste de textes) :
// affichage pour les employés et la fiche admin, édition dans les paramètres.
import { useT } from '@/lib/i18n/client'

/** Nettoie la liste : textes coupés, vides retirés, doublons retirés, 12 au maximum (fonction pure, testée). */
export function nettoyerObjectifs(liste: unknown): string[] {
  if (!Array.isArray(liste)) return []
  const vus = new Set<string>()
  const res: string[] = []
  for (const x of liste) {
    if (typeof x !== 'string') continue
    const v = x.replace(/\s+/g, ' ').trim().slice(0, 300)
    if (!v || vus.has(v.toLowerCase())) continue
    vus.add(v.toLowerCase()); res.push(v)
  }
  return res.slice(0, 12)
}

export function ListeObjectifs({ objectifs, compact = false }: { objectifs: string[] | null | undefined; compact?: boolean }) {
  const { t } = useT()
  const liste = nettoyerObjectifs(objectifs)
  if (!liste.length) return null
  return (
    <div className={compact ? 'mt-3' : 'mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4'}>
      <p className="text-sm font-semibold text-gray-800 mb-2">🎯 {t('Objectifs de la formation')}</p>
      <ul className="space-y-1.5">
        {liste.map((o, i) => (
          <li key={i} className="flex gap-2 text-sm text-gray-700 leading-relaxed">
            <span aria-hidden className="mt-0.5 font-bold" style={{ color: 'var(--accent-clinique, #4f46e5)' }}>✓</span>
            <span>{o}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function EditeurObjectifs({ objectifs, onChange, disabled }: { objectifs: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  const { t } = useT()
  const maj = (i: number, v: string) => onChange(objectifs.map((o, j) => (j === i ? v : o)))
  const deplacer = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= objectifs.length) return
    const copie = [...objectifs]; [copie[i], copie[j]] = [copie[j], copie[i]]; onChange(copie)
  }
  return (
    <div className="space-y-2">
      {objectifs.map((o, i) => (
        <div key={i} className="flex gap-2 items-center">
          <span className="text-xs text-gray-400 w-5 text-right">{i + 1}.</span>
          <input value={o} onChange={e => maj(i, e.target.value)} disabled={disabled} maxLength={300}
            placeholder={t('Ex. : Connaître les étapes du parcours préopératoire')}
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
          <button type="button" onClick={() => deplacer(i, -1)} disabled={disabled || i === 0} className="px-2 py-1 text-gray-500 disabled:opacity-30" aria-label={t('Monter')}>↑</button>
          <button type="button" onClick={() => deplacer(i, 1)} disabled={disabled || i === objectifs.length - 1} className="px-2 py-1 text-gray-500 disabled:opacity-30" aria-label={t('Descendre')}>↓</button>
          <button type="button" onClick={() => onChange(objectifs.filter((_, j) => j !== i))} disabled={disabled} className="px-2 py-1 text-red-500" aria-label={t('Retirer')}>✕</button>
        </div>
      ))}
      {objectifs.length < 12 && (
        <button type="button" onClick={() => onChange([...objectifs, ''])} disabled={disabled} className="text-sm font-medium text-indigo-600 hover:underline">
          + {t('Ajouter un objectif')}
        </button>
      )}
      <p className="text-xs text-gray-400">{t('Affichés aux employés en haut de la formation. 12 au maximum.')}</p>
    </div>
  )
}
