'use client'
// Case « Mise en page des événements » : visible seulement pour l'administrateur global,
// pour une personne qui peut créer des événements (admin, ou gestionnaire autorisé).
import { useT } from '@/lib/i18n/client'

export default function CaseMiseEnPageEvenements({ coche, onChange }: { coche: boolean; onChange: (v: boolean) => void }) {
  const { t } = useT()
  return (
    <div className="flex items-start gap-3 rounded-lg border border-pink-100 bg-pink-50/60 p-3">
      <input type="checkbox" id="peut_mise_en_page_evenements" checked={coche} onChange={e => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600" />
      <label htmlFor="peut_mise_en_page_evenements" className="text-sm font-medium text-gray-800">
        ⭐ {t('Mise en vedette des événements')}
        <span className="block text-xs font-normal text-gray-500">{t('Accordé par l’administrateur global. La personne peut choisir l’événement mis en vedette dans la grande bannière de la page Événements.')}</span>
      </label>
    </div>
  )
}
