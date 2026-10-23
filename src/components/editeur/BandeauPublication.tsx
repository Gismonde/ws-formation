'use client'
// Bandeau de l'éditeur : formation publiée (modifications visibles tout de suite) ou copie de travail (invisible des employés).
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n/client'

export default function BandeauPublication({ formationId, publiee, copieDe }: { formationId: string; publiee: boolean; copieDe: string | null }) {
  const { t } = useT()
  const router = useRouter()
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  if (copieDe) {
    return (
      <div className="bg-violet-600 text-white px-6 py-2.5 text-sm flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>✏️ <strong>{t('Copie de travail')}</strong> — {t('les employés ne voient pas ces changements tant que la copie n’est pas approuvée puis appliquée.')}</span>
        <Link href={`/admin/formations/${formationId}`} className="underline font-semibold">{t('Envoyer en validation / appliquer')}</Link>
      </div>
    )
  }
  if (!publiee) return null

  const copie = async () => {
    setEnvoi(true); setErreur(null)
    const r = await fetch(`/api/admin/formations/${formationId}/copie-travail`, { method: 'POST' })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { setErreur(d.error ?? t('Erreur')); setEnvoi(false); return }
    router.push(`/admin/formations/${d.id}/editeur`)
  }
  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-6 py-2.5 text-sm flex flex-wrap items-center gap-x-4 gap-y-1">
      <span>⚠️ <strong>{t('Formation publiée')}</strong> : {t('chaque modification ici est visible immédiatement par les employés.')}</span>
      <button type="button" onClick={copie} disabled={envoi} className="font-semibold px-3 py-1 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50">
        {envoi ? t('Copie en cours…') : t('Travailler sur une copie de travail')}
      </button>
      {erreur && <span className="text-red-600">{erreur}</span>}
    </div>
  )
}
