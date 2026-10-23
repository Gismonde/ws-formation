'use client'
// Case « Membre externe » (CMC) des formulaires de création et de modification.
import { useT } from '@/lib/i18n/client'
import { externeOffert } from '@/lib/membres-externes'

export default function ChampExterne({ role, clinique, externe, organisation, setExterne, setOrganisation, inputCls, labelCls }: {
  role: string; clinique: string; externe: boolean; organisation: string
  setExterne: (v: boolean) => void; setOrganisation: (v: string) => void; inputCls: string; labelCls: string
}) {
  const { t } = useT()
  if (role !== 'employe' || !externeOffert(clinique)) return null
  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" checked={externe} onChange={e => setExterne(e.target.checked)} className="w-4 h-4 mt-0.5 text-indigo-600 rounded border-gray-300" />
        <span>
          <span className="block text-sm font-medium text-gray-700">{t('Membre externe')}</span>
          <span className="block text-xs text-gray-500">{t('Personne qui n’est pas employée de la clinique (partenaire, stagiaire, sous-traitant…). Mêmes fonctions et autorisations qu’un employé.')}</span>
        </span>
      </label>
      {externe && (
        <div>
          <label className={labelCls}>{t('Organisation')}</label>
          <input className={inputCls} value={organisation} onChange={e => setOrganisation(e.target.value)} placeholder={t('Ex : GrS Montréal, CIUSSS…')} maxLength={120} />
        </div>
      )}
    </div>
  )
}
