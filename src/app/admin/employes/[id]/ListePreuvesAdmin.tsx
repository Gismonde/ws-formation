'use client'
// Onglet « Preuves » de la fiche employé : consulter le document, valider ou refuser avec un commentaire.
import { useT } from '@/lib/i18n/client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PreuveDossier } from '@/lib/dossier-employe'

const dateEn = (loc: string) => (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(loc, { dateStyle: 'medium' }) : '—')
const BADGE = {
  en_attente: 'bg-amber-50 text-amber-700 border-amber-200',
  valide: 'bg-green-50 text-green-700 border-green-200',
  refuse: 'bg-red-50 text-red-700 border-red-200',
} as const

export default function ListePreuvesAdmin({ preuves, peutDecider }: { preuves: PreuveDossier[]; peutDecider: boolean }) {
  const { t, loc } = useT()
  const date = dateEn(loc)
  const router = useRouter()
  const [commentaires, setCommentaires] = useState<Record<string, string>>({})
  const [enCours, setEnCours] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  async function decider(id: string, statut: 'valide' | 'refuse') {
    setEnCours(id + statut); setErreur(null)
    const r = await fetch('/api/admin/valider-preuve', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preuve_id: id, statut, commentaire: commentaires[id]?.trim() || null }),
    })
    const d = await r.json().catch(() => ({}))
    setEnCours(null)
    if (!r.ok) return setErreur(d.error ?? t('Opération impossible'))
    router.refresh()
  }

  if (preuves.length === 0) {
    return <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">{t('Aucune preuve externe soumise.')}</div>
  }

  const enAttente = preuves.filter(p => p.statut === 'en_attente')
  const traitees = preuves.filter(p => p.statut !== 'en_attente')

  const carte = (p: PreuveDossier) => (
    <div key={p.id} className={'bg-white border rounded-xl p-4 ' + (p.statut === 'en_attente' ? 'border-amber-200' : 'border-gray-200')}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-[200px]">
          <div className="text-xs font-semibold text-indigo-600">{p.formation}</div>
          <div className="font-medium text-gray-900 break-all">📎 {p.fichier || 'Document'}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {t('Soumise le {date}', { date: date(p.soumis_le) })}{p.traite_le ? ' · ' + t('traitée le {date}', { date: date(p.traite_le) }) : ''}
          </div>
          {p.commentaire && <div className="text-xs text-gray-600 italic mt-1">« {p.commentaire} »</div>}
        </div>
        <span className={'text-xs font-semibold px-2.5 py-1 rounded-full border ' + BADGE[p.statut]}>{p.statut_libelle}</span>
        {p.chemin && (
          <a href={`/api/preuves/${p.id}/fichier`} target="_blank" rel="noopener noreferrer"
            className="text-sm font-semibold px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">{t('Ouvrir le document')}</a>
        )}
      </div>
      {p.statut === 'en_attente' && peutDecider && (
        <div className="mt-3 flex flex-wrap gap-2">
          <input value={commentaires[p.id] ?? ''} onChange={e => setCommentaires(c => ({ ...c, [p.id]: e.target.value }))}
            placeholder={t('Commentaire pour l’employé (facultatif)')} maxLength={500}
            className="flex-1 min-w-[200px] border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          <button type="button" onClick={() => decider(p.id, 'valide')} disabled={!!enCours}
            className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold disabled:opacity-50">
            {enCours === p.id + 'valide' ? '…' : '✓ Valider'}
          </button>
          <button type="button" onClick={() => decider(p.id, 'refuse')} disabled={!!enCours}
            className="px-4 py-2 rounded-lg bg-white border border-red-200 text-red-600 text-sm font-semibold disabled:opacity-50">
            {enCours === p.id + 'refuse' ? '…' : '✗ Refuser'}
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      {erreur && <p className="text-sm text-red-600">{erreur}</p>}
      {enAttente.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-amber-800 mb-2">À vérifier ({enAttente.length})</h3>
          <div className="space-y-3">{enAttente.map(carte)}</div>
        </section>
      )}
      {traitees.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-gray-600 mb-2">Déjà traitées ({traitees.length})</h3>
          <div className="space-y-3">{traitees.map(carte)}</div>
        </section>
      )}
    </div>
  )
}
