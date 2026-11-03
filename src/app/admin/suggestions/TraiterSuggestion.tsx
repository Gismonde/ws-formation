'use client'
// Statut et réponse d'une suggestion (visible par l'employé dans « Mes suggestions »).
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n/client'
import { STATUTS_SUGGESTION, type StatutSuggestion } from '@/lib/suggestions'

export default function TraiterSuggestion({ id, statut, reponse, anonyme, assigneA, admins = [], moi }: {
  id: string; statut: StatutSuggestion; reponse: string | null; anonyme: boolean
  /** Administrateur responsable (undefined : colonne absente) */
  assigneA?: string | null
  admins?: { id: string; nom: string }[]
  moi: string
}) {
  const { t } = useT()
  const router = useRouter()
  const [s, setS] = useState(statut)
  const [r, setR] = useState(reponse ?? '')
  const [assigne, setAssigne] = useState(assigneA ?? '')
  const [etat, setEtat] = useState<'ok' | 'envoi' | 'enregistre' | string>('ok')
  const enregistrer = async (corps: Record<string, unknown>) => {
    setEtat('envoi')
    const res = await fetch(`/api/admin/suggestions/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) })
    const d = await res.json().catch(() => ({}))
    setEtat(res.ok ? 'enregistre' : (d.error ?? t('Erreur')))
    if (res.ok) router.refresh()
  }
  return (
    <div className="mt-3 flex flex-wrap items-start gap-2">
      {assigneA !== undefined && <select value={assigne} onChange={e => { setAssigne(e.target.value); enregistrer({ assigne_a: e.target.value || null }) }} title={t('Responsable du suivi')}
        className={'border rounded-lg px-2 py-1.5 text-sm ' + (assigne ? 'border-indigo-300 bg-indigo-50 text-indigo-900' : 'border-gray-300')}>
        <option value="">{t('👤 Assigner à…')}</option>
        <option value={moi}>{t('Moi-même')}</option>
        {admins.filter(a => a.id !== moi).map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
      </select>}
      <select value={s} onChange={e => { setS(e.target.value as StatutSuggestion); enregistrer({ statut: e.target.value }) }} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
        {STATUTS_SUGGESTION.map(x => <option key={x.id} value={x.id}>{t(x.libelle)}</option>)}
      </select>
      <textarea value={r} onChange={e => setR(e.target.value)} rows={1} maxLength={1000}
        placeholder={anonyme ? t('Réponse (l’auteur anonyme la verra dans « Mes suggestions »)') : t('Réponse à l’employé (facultatif)')}
        className="flex-1 min-w-[220px] border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
      <button type="button" onClick={() => enregistrer({ reponse: r })} disabled={etat === 'envoi' || r === (reponse ?? '')}
        className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 text-white disabled:opacity-40">{t('Répondre')}</button>
      {etat === 'enregistre' && <span className="text-xs text-green-700 self-center">✓ {t('Enregistré')}</span>}
      {etat !== 'ok' && etat !== 'envoi' && etat !== 'enregistre' && <span className="text-xs text-red-600 self-center">{etat}</span>}
    </div>
  )
}
