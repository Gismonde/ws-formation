'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n/client'
import { useConfirmer } from '@/components/Confirmation'

export default function ReinitialiserTentatives({ employeId, formationId }: { employeId: string; formationId: string }) {
  const router = useRouter()
  const { t } = useT()
  const confirmer = useConfirmer()
  const [etat, setEtat] = useState<'repos' | 'envoi' | 'erreur'>('repos')
  const [msg, setMsg] = useState('')

  async function go() {
    if (!(await confirmer({ message: t('Redonner toutes ses tentatives à cet employé ? Les tentatives échouées restent conservées dans l’historique.'), bouton: t('Redonner les tentatives') }))) return
    setEtat('envoi')
    const res = await fetch('/api/admin/reinitialiser-tentatives', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employeId, formationId }),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setEtat('erreur'); setMsg(d.error ?? 'Erreur'); return }
    setEtat('repos'); router.refresh()
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={e => { e.preventDefault(); go() }} disabled={etat === 'envoi'}
        className="text-xs font-medium px-2.5 py-1 rounded-md border border-indigo-600 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">
        {etat === 'envoi' ? '…' : '↺ Redonner des tentatives'}
      </button>
      {etat === 'erreur' && <span className="text-xs text-red-600">{msg}</span>}
    </span>
  )
}
