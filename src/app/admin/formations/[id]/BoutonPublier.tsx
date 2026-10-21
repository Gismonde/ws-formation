'use client'
// Publier une formation (visible par les employés à qui elle est assignée) ou la repasser en brouillon.
import { useT } from '@/lib/i18n/client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { togglePublierFormation } from '@/lib/actions/formations'

export default function BoutonPublier({ formationId, publiee, enAttente }: { formationId: string; publiee: boolean; enAttente: number }) {
  const { t } = useT()
  const router = useRouter()
  const [envoi, setEnvoi] = useState(false)
  const [confirmer, setConfirmer] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const basculer = async () => {
    if (!publiee && enAttente > 0 && !confirmer) { setConfirmer(true); return }
    setEnvoi(true); setErreur(null)
    const r = await togglePublierFormation(formationId, !publiee)
    setEnvoi(false); setConfirmer(false)
    if (!r.success) setErreur(r.error ?? 'Erreur')
    else router.refresh()
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button onClick={basculer} disabled={envoi}
        className={'text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50 ' + (publiee ? 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50' : 'bg-green-600 text-white hover:bg-green-700')}>
        {envoi ? '…' : publiee ? t('Repasser en brouillon') : confirmer ? t('Publier quand même') : t('Publier')}
      </button>
      {confirmer && <p className="text-xs text-amber-700 max-w-xs text-right">{t('Il reste {n} bloc(s) « à ajouter » : les employés les verront tels quels.', { n: enAttente })}</p>}
      {!publiee && !confirmer && <p className="text-xs text-gray-400 max-w-xs text-right">{t('Les employés à qui elle est assignée la verront dans « Mes formations ».')}</p>}
      {erreur && <p className="text-xs text-red-600">{erreur}</p>}
    </div>
  )
}
