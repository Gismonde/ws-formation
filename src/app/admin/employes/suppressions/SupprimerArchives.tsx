'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Ligne = { id: string; nom: string; email: string | null; detail: string }

export default function SupprimerArchives({ employes }: { employes: Ligne[] }) {
  const router = useRouter()
  const [choisis, setChoisis] = useState<Set<string>>(new Set())
  const [raison, setRaison] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null)

  const basculer = (id: string) => setChoisis(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const tous = employes.length > 0 && choisis.size === employes.length
  const pret = choisis.size > 0 && raison.trim().length >= 10 && confirmation.trim().toUpperCase() === 'SUPPRIMER'

  const supprimer = async () => {
    setEnvoi(true); setMessage(null)
    const r = await fetch('/api/admin/employes/supprimer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: Array.from(choisis), raison }) })
    const d = await r.json().catch(() => ({}))
    setEnvoi(false)
    if (!r.ok) { setMessage({ ok: false, texte: d.error ?? 'Erreur' }); return }
    const erreurs = (d.resultats as { nom: string; erreur?: string }[]).filter(x => x.erreur)
    setMessage({ ok: erreurs.length === 0, texte: `${d.supprimes} employé(s) supprimé(s) définitivement.` + (erreurs.length ? ' Échecs : ' + erreurs.map(x => `${x.nom} (${x.erreur})`).join(', ') : '') })
    setChoisis(new Set()); setRaison(''); setConfirmation('')
    router.refresh()
  }

  if (employes.length === 0) return <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">Aucun employé archivé. Archivez d’abord un employé depuis la liste des employés.{message && <p className={'mt-3 ' + (message.ok ? 'text-green-700' : 'text-red-600')}>{message.texte}</p>}</div>

  return (
    <div className="bg-white border border-gray-200 rounded-xl">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input type="checkbox" checked={tous} onChange={() => setChoisis(tous ? new Set() : new Set(employes.map(e => e.id)))} />
          Employés archivés ({employes.length})
        </label>
        <span className="text-xs text-gray-500">{choisis.size} sélectionné(s)</span>
      </div>
      <ul className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
        {employes.map(e => (
          <li key={e.id}>
            <label className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" checked={choisis.has(e.id)} onChange={() => basculer(e.id)} />
              <span className="flex-1 min-w-0"><span className="font-medium text-gray-900">{e.nom}</span> <span className="text-xs text-gray-500">{e.email}</span></span>
              <span className="text-xs text-gray-500">{e.detail}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="p-4 border-t border-gray-100 space-y-3 bg-red-50/40 rounded-b-xl">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Raison de la suppression (obligatoire)</label>
          <textarea value={raison} onChange={e => setRaison(e.target.value)} rows={2} maxLength={1000}
            placeholder="Ex. : compte créé par erreur (doublon de l’employée Marie Tremblay)" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tapez <strong>SUPPRIMER</strong> pour confirmer</label>
            <input value={confirmation} onChange={e => setConfirmation(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <button onClick={supprimer} disabled={!pret || envoi} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:opacity-40">
            {envoi ? 'Suppression…' : `Supprimer définitivement ${choisis.size || ''} employé${choisis.size > 1 ? 's' : ''}`}
          </button>
        </div>
        {message && <p className={'text-sm ' + (message.ok ? 'text-green-700' : 'text-red-600')}>{message.texte}</p>}
      </div>
    </div>
  )
}
