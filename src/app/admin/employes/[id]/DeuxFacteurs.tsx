'use client'
// Administrateur global : voir si la double authentification d'un employé est activée et la réinitialiser.
import { useEffect, useState } from 'react'
import { useT } from '@/lib/i18n/client'
import { useConfirmer } from '@/components/Confirmation'

export default function DeuxFacteurs({ employeId, nom }: { employeId: string; nom: string }) {
  const { t } = useT()
  const confirmer = useConfirmer()
  const [active, setActive] = useState<boolean | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  useEffect(() => {
    fetch(`/api/admin/employes/${employeId}/deux-facteurs`).then(r => r.json()).then(d => setActive(!!d.active)).catch(() => setActive(null))
  }, [employeId])

  async function reinitialiser() {
    if (!(await confirmer({
      titre: t('Réinitialiser la double authentification'),
      message: t('{nom} devra configurer de nouveau son application d’authentification à sa prochaine connexion. À utiliser si le téléphone a été perdu ou changé.', { nom }),
      bouton: t('Réinitialiser'), danger: true,
    }))) return
    setEnvoi(true); setMsg(null)
    const r = await fetch(`/api/admin/employes/${employeId}/deux-facteurs`, { method: 'DELETE' })
    const d = await r.json().catch(() => ({}))
    setEnvoi(false)
    if (r.ok) { setActive(false); setMsg(t('Double authentification réinitialisée.')) } else setMsg(d.error ?? t('Erreur'))
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mt-3 flex flex-wrap items-center gap-3">
      <div className="flex-1 min-w-[200px]">
        <p className="text-sm font-semibold text-gray-900">{t('Double authentification (2FA)')}</p>
        <p className="text-xs text-gray-500">
          {active === null ? '…' : active ? '🛡️ ' + t('Activée') : t('Non activée')}
          {msg && <span className="ml-2 text-gray-700">· {msg}</span>}
        </p>
      </div>
      {active && (
        <button type="button" onClick={reinitialiser} disabled={envoi} className="px-4 py-2 border border-red-300 text-red-700 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50">
          {t('Réinitialiser la 2FA')}
        </button>
      )}
    </div>
  )
}
