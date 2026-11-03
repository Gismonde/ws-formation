'use client'
// Publier / retirer / archiver un formulaire depuis la liste.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n/client'

export default function ActionsFormulaire({ id, actif, archive }: { id: string; actif: boolean; archive: boolean }) {
  const { t } = useT()
  const router = useRouter()
  const [envoi, setEnvoi] = useState(false)
  const appel = async (corps: Record<string, boolean>) => {
    setEnvoi(true)
    try { await fetch(`/api/admin/formulaires/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) }); router.refresh() }
    finally { setEnvoi(false) }
  }
  const cls = 'rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50 '
  if (archive) return <button type="button" disabled={envoi} onClick={() => appel({ archive: false })} className={cls + 'text-gray-600 hover:bg-gray-100'}>{t('Désarchiver')}</button>
  return (
    <>
      <button type="button" disabled={envoi} onClick={() => appel({ actif: !actif })} className={cls + (actif ? 'text-gray-700 hover:bg-gray-100' : 'bg-green-600 text-white hover:bg-green-700')}>
        {actif ? t('Retirer') : t('Publier')}
      </button>
      <button type="button" disabled={envoi} onClick={() => appel({ archive: true })} className={cls + 'text-gray-500 hover:bg-gray-100'}>{t('Archiver')}</button>
    </>
  )
}
