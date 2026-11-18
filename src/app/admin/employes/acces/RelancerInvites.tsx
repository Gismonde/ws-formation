'use client'
// « Relancer tous les invités » : renvoie le courriel d'activation aux employés invités qui n'ont pas
// encore activé leur compte (par lots de 20, avec l'avancement).
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n/client'
import { useConfirmer } from '@/components/Confirmation'

export default function RelancerInvites({ ids }: { ids: string[] }) {
  const { t } = useT()
  const router = useRouter()
  const confirmer = useConfirmer()
  const [avancement, setAvancement] = useState<string | null>(null)
  const [bilan, setBilan] = useState<{ ok: boolean; texte: string; erreurs: string[] } | null>(null)
  if (ids.length === 0 && !bilan) return null

  async function relancer() {
    if (!(await confirmer({ message: t('Renvoyer le courriel d’activation aux {n} employé(s) invités qui n’ont pas encore activé leur compte ? Les comptes déjà activés ne reçoivent rien.', { n: ids.length }), bouton: t('Relancer') }))) return
    setBilan(null)
    let envoyes = 0
    const erreurs: string[] = []
    for (let i = 0; i < ids.length; i += 20) {
      setAvancement(t('Envoi… {fait} sur {total}', { fait: Math.min(i, ids.length), total: ids.length }))
      const r = await fetch('/api/admin/relancer-invites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: ids.slice(i, i + 20) }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { erreurs.push(d.error ?? t('Erreur')); break }
      envoyes += d.envoyes ?? 0
      erreurs.push(...(d.erreurs ?? []))
    }
    setAvancement(null)
    setBilan({ ok: erreurs.length === 0, texte: t('{n} courriel(s) d’activation renvoyé(s).', { n: envoyes }), erreurs })
    router.refresh()
  }

  return (
    <div className="mb-6">
      <button type="button" onClick={relancer} disabled={!!avancement || ids.length === 0} className="text-sm font-semibold px-4 py-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50">
        {avancement ?? `✉️ ${t('Relancer tous les invités')} (${ids.length})`}
      </button>
      <span className="text-xs text-gray-500 ml-3">{t('Seulement les employés invités qui n’ont pas encore activé leur compte.')}</span>
      {bilan && (
        <div className={'mt-3 rounded-lg px-4 py-3 text-sm ' + (bilan.ok ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800')}>
          {bilan.texte}
          {bilan.erreurs.length > 0 && <ul className="mt-1 list-disc ml-5 text-xs">{bilan.erreurs.map((e, i) => <li key={i}>{e}</li>)}</ul>}
        </div>
      )}
    </div>
  )
}
