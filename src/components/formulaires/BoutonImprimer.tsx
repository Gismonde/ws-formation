'use client'
import { useT } from '@/lib/i18n/client'

export default function BoutonImprimer() {
  const { t } = useT()
  return (
    <button type="button" onClick={() => window.print()} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 print:hidden">
      🖨️ {t('Imprimer / PDF')}
    </button>
  )
}
