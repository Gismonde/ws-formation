'use client'
// Publier une formation (visible par les employés à qui elle est assignée) ou la repasser en brouillon.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { togglePublierFormation } from '@/lib/actions/formations'

export default function BoutonPublier({ formationId, publiee, enAttente }: { formationId: string; publiee: boolean; enAttente: number }) {
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
        {envoi ? '…' : publiee ? 'Repasser en brouillon' : confirmer ? 'Publier quand même' : 'Publier'}
      </button>
      {confirmer && <p className="text-xs text-amber-700 max-w-xs text-right">Il reste {enAttente} bloc(s) « à ajouter » : les employés les verront tels quels.</p>}
      {!publiee && !confirmer && <p className="text-xs text-gray-400 max-w-xs text-right">Les employés à qui elle est assignée la verront dans « Mes formations ».</p>}
      {erreur && <p className="text-xs text-red-600">{erreur}</p>}
    </div>
  )
}
