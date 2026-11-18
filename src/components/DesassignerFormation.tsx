'use client'
// Bouton « Désassigner » (fiche employé, statistiques d'une formation), avec confirmation.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n/client'
import { useConfirmer } from '@/components/Confirmation'

export default function DesassignerFormation({ employeId, formationId, nomEmploye, titreFormation }: { employeId: string; formationId: string; nomEmploye: string; titreFormation: string }) {
  const router = useRouter()
  const { t } = useT()
  const confirmer = useConfirmer()
  const [etat, setEtat] = useState<'repos' | 'envoi' | 'erreur'>('repos')
  const [msg, setMsg] = useState('')

  async function go() {
    const ok = await confirmer({
      message: t('Désassigner « {formation} » de {employe} ? La formation disparaîtra de ses formations, sans courriel. Sa progression et ses certificats sont conservés : si vous la lui réassignez, il reprendra où il en était.', { formation: titreFormation, employe: nomEmploye }),
      bouton: t('Désassigner'),
    })
    if (!ok) return
    setEtat('envoi')
    const res = await fetch('/api/admin/desassigner', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employeId, formationId }) })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setEtat('erreur'); setMsg(d.error ?? t('Erreur')); return }
    setEtat('repos'); router.refresh()
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); go() }} disabled={etat === 'envoi'}
        className="text-xs font-medium px-2.5 py-1 rounded-md border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 whitespace-nowrap">
        {etat === 'envoi' ? '…' : t('Désassigner')}
      </button>
      {etat === 'erreur' && <span className="text-xs text-red-600">{msg}</span>}
    </span>
  )
}
