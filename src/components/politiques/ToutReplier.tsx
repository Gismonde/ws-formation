'use client'
// « Tout réduire » / « Tout déplier » pour les sections de catégories.
import { useT } from '@/lib/i18n/client'

export default function ToutReplier() {
  const { t } = useT()
  const regler = (ouvert: boolean) => document.querySelectorAll<HTMLDetailsElement>('details[data-categorie]').forEach(d => { d.open = ouvert })
  return (
    <div className="flex gap-1 text-xs font-semibold">
      <button type="button" onClick={() => regler(false)} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-gray-600 hover:bg-gray-50">▸ {t('Tout réduire')}</button>
      <button type="button" onClick={() => regler(true)} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-gray-600 hover:bg-gray-50">▾ {t('Tout déplier')}</button>
    </div>
  )
}
