'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n/client'
import type { DemandeAcces } from '@/lib/formations-libres'

/** Demandes d'accès d'une formation « sur demande » : onglets En attente / Traitées, accepter ou refuser. */
export default function DemandesAcces({ formationId, demandes, mode }: { formationId: string; demandes: DemandeAcces[]; mode: string }) {
  const { t, loc } = useT()
  const router = useRouter()
  const [onglet, setOnglet] = useState<'attente' | 'traitees'>('attente')
  const [refus, setRefus] = useState<string | null>(null)
  const [motif, setMotif] = useState('')
  const [envoi, setEnvoi] = useState<string | null>(null)
  const [erreur, setErreur] = useState('')
  const attente = demandes.filter(d => d.statut === 'en_attente')
  const traitees = demandes.filter(d => d.statut !== 'en_attente')
  const liste = onglet === 'attente' ? attente : traitees
  const date = (d: string | null) => d ? new Date(d).toLocaleDateString(loc, { dateStyle: 'medium', timeZone: 'America/Toronto' }) : ''

  async function decider(demandeId: string, decision: 'acceptee' | 'refusee') {
    setEnvoi(demandeId); setErreur('')
    const r = await fetch(`/api/admin/formations/${formationId}/demandes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ demandeId, decision, motif: decision === 'refusee' ? motif : '' }) })
    setEnvoi(null)
    if (!r.ok) { setErreur(t('La demande n’a pas pu être traitée.')); return }
    setRefus(null); setMotif(''); router.refresh()
  }

  const ongletStyle = (actif: boolean) => `px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${actif ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-5 pt-4">
        <h2 className="font-bold text-gray-900">📩 {t('Demandes d’accès')}</h2>
        <p className="text-xs text-gray-500 mt-1">
          {mode === 'demande' ? t('Formation disponible sur demande : une demande acceptée inscrit l’employé sans obligation (hors conformité) et lui envoie un courriel.')
            : mode === 'libre' ? t('Formation disponible sans obligation : les employés la commencent sans demande.')
            : t('Accès hors assignation désactivé : aucune nouvelle demande ne peut être faite.')}
        </p>
      </div>
      <div className="flex gap-1 border-b border-gray-200 px-3 mt-3" role="tablist">
        <button type="button" role="tab" aria-selected={onglet === 'attente'} className={ongletStyle(onglet === 'attente')} onClick={() => setOnglet('attente')}>
          {t('En attente')} {attente.length > 0 && <span className="ml-1 text-xs bg-amber-100 text-amber-800 rounded-full px-2 py-0.5">{attente.length}</span>}
        </button>
        <button type="button" role="tab" aria-selected={onglet === 'traitees'} className={ongletStyle(onglet === 'traitees')} onClick={() => setOnglet('traitees')}>
          {t('Traitées')} {traitees.length > 0 && <span className="ml-1 text-xs bg-gray-100 text-gray-700 rounded-full px-2 py-0.5">{traitees.length}</span>}
        </button>
      </div>
      {erreur && <p className="text-sm text-red-600 px-5 pt-3">{erreur}</p>}
      {liste.length === 0 ? (
        <p className="text-sm text-gray-500 px-5 py-6">{onglet === 'attente' ? t('Aucune demande en attente.') : t('Aucune demande traitée pour l’instant.')}</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {liste.map(d => (
            <li key={d.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{d.nom}{d.poste && <span className="font-normal text-gray-500"> · {d.poste}</span>}{d.langue === 'en' && <span className="ml-2 text-[11px] font-semibold bg-sky-100 text-sky-800 rounded px-1.5 py-0.5" title={t('Demande faite sur la version anglaise')}>EN</span>}</p>
                  <p className="text-xs text-gray-500">{t('Demandée le {date}', { date: date(d.demandee_le) })}</p>
                  {d.message && <p className="text-sm text-gray-700 mt-1 bg-gray-50 rounded-lg px-3 py-2">« {d.message} »</p>}
                  {d.statut !== 'en_attente' && (
                    <p className={`text-xs mt-1 font-semibold ${d.statut === 'acceptee' ? 'text-green-700' : 'text-red-700'}`}>
                      {d.statut === 'acceptee' ? '✓ ' + t('Acceptée') : '✕ ' + t('Refusée')}
                      {d.traitee_le ? ` · ${date(d.traitee_le)}` : ''}{d.traitee_par_nom ? ` · ${t('par {nom}', { nom: d.traitee_par_nom })}` : ''}
                      {d.motif ? ` — ${d.motif}` : ''}
                    </p>
                  )}
                </div>
                {d.statut === 'en_attente' && refus !== d.id && (
                  <div className="flex gap-2">
                    <button type="button" disabled={envoi === d.id} onClick={() => decider(d.id, 'acceptee')} className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-60">{t('Accepter')}</button>
                    <button type="button" disabled={envoi === d.id} onClick={() => { setRefus(d.id); setMotif('') }} className="px-3 py-1.5 rounded-lg border border-red-300 text-red-700 text-sm font-semibold hover:bg-red-50 disabled:opacity-60">{t('Refuser')}</button>
                  </div>
                )}
              </div>
              {refus === d.id && (
                <div className="mt-3 flex flex-col sm:flex-row gap-2">
                  <input value={motif} onChange={e => setMotif(e.target.value)} maxLength={300} placeholder={t('Motif du refus (facultatif, transmis à l’employé)')} className="flex-1 border rounded-lg px-3 py-1.5 text-sm" />
                  <button type="button" disabled={envoi === d.id} onClick={() => decider(d.id, 'refusee')} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:opacity-60">{t('Confirmer le refus')}</button>
                  <button type="button" onClick={() => setRefus(null)} className="px-3 py-1.5 rounded-lg border text-sm">{t('Annuler')}</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
