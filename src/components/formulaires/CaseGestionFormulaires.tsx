'use client'
// Case « Gestion des formulaires » (WSSC) : visible seulement pour l'administrateur global.
import { useT } from '@/lib/i18n/client'

export default function CaseGestionFormulaires({ coche, onChange }: { coche: boolean; onChange: (v: boolean) => void }) {
  const { t } = useT()
  return (
    <div className="flex items-start gap-3 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3">
      <input type="checkbox" id="peut_creer_formulaires" checked={coche} onChange={e => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600" />
      <label htmlFor="peut_creer_formulaires" className="text-sm font-medium text-gray-800">
        📝 {t('Gestion des formulaires (WSSC)')}
        <span className="block text-xs font-normal text-gray-500">{t('Accordé par l’administrateur global. La personne peut créer des formulaires à remplir par les employés du WSSC et choisir qui reçoit les réponses.')}</span>
      </label>
    </div>
  )
}
