'use client'
// Équipe de La Passerelle (quel que soit leur rôle) : gère le journal, voit les propositions et reçoit un courriel à chaque proposition.
import { useMemo, useState } from 'react'
import { useT } from '@/lib/i18n/client'

type Employe = { id: string; prenom: string | null; nom: string | null; poste: string | null; email: string | null }
const nomDe = (e: Employe) => [e.prenom, e.nom].filter(Boolean).join(' ') || e.email || '—'
const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function DestinatairesForm({ employes, choisis, comite }: { employes: Employe[]; choisis: string[]; comite: { nom: string; ids: string[]; nonInscrits: string[] } | null }) {
  const { t } = useT()
  const [ids, setIds] = useState<string[]>(choisis)
  const [q, setQ] = useState('')
  const [etat, setEtat] = useState<{ ok: boolean; texte: string } | null>(null)
  const parId = useMemo(() => new Map(employes.map(e => [e.id, e])), [employes])
  const resultats = q.trim().length < 2 ? [] : employes.filter(e => !ids.includes(e.id) && sansAccents(`${nomDe(e)} ${e.poste ?? ''} ${e.email ?? ''}`).includes(sansAccents(q.trim()))).slice(0, 8)

  async function enregistrer() {
    setEtat(null)
    const r = await fetch('/api/admin/passerelle/destinataires', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employes: ids }) })
    const d = await r.json().catch(() => ({}))
    setEtat(r.ok ? { ok: true, texte: t('Enregistré.') } : { ok: false, texte: d.error ?? t('Erreur') })
  }

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
      <h2 className="text-base font-semibold text-gray-900">{t('Équipe de La Passerelle')}</h2>
      <p className="text-xs text-gray-500 mb-3">{t('Elles voient « Gérer La Passerelle » dans le portail et reçoivent un courriel à chaque nouvelle proposition d’un employé.')}</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {ids.length === 0 && <span className="text-sm text-gray-400 italic">{t('Personne pour l’instant.')}</span>}
        {ids.map(id => {
          const e = parId.get(id)
          return (
            <span key={id} className="inline-flex items-center gap-2 text-sm rounded-full bg-indigo-50 text-indigo-800 pl-3 pr-1 py-1">
              {e ? nomDe(e) : t('Employé retiré')}
              <button type="button" onClick={() => setIds(l => l.filter(x => x !== id))} className="w-6 h-6 rounded-full hover:bg-indigo-100" aria-label={t('Retirer')}>✕</button>
            </span>
          )
        })}
      </div>
      {comite && comite.ids.some(id => !ids.includes(id)) && (
        <button type="button" onClick={() => setIds(l => Array.from(new Set([...l, ...comite.ids])))} className="mb-3 text-sm font-medium px-3 py-1.5 rounded-lg border border-indigo-600 text-indigo-700 hover:bg-indigo-50">
          + {t('Ajouter les membres du comité « {nom} »', { nom: comite.nom })}
        </button>
      )}
      {comite && comite.nonInscrits.length > 0 && <p className="text-xs text-amber-700 mb-3">{t('Sans compte sur la plateforme, donc impossibles à ajouter : {noms}', { noms: comite.nonInscrits.join(', ') })}</p>}
      <div className="relative max-w-md">
        <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder={t('Ajouter une personne : tapez un nom…')} value={q} onChange={e => setQ(e.target.value)} />
        {resultats.length > 0 && (
          <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
            {resultats.map(e => (
              <li key={e.id}>
                <button type="button" onClick={() => { setIds(l => [...l, e.id]); setQ('') }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
                  <span className="font-medium text-gray-900">{nomDe(e)}</span>{e.poste && <span className="text-gray-500"> · {e.poste}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {etat && <p className={'text-sm mt-2 ' + (etat.ok ? 'text-green-700' : 'text-red-600')}>{etat.texte}</p>}
      <button type="button" onClick={enregistrer} className="mt-3 text-sm font-semibold px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">{t('Enregistrer')}</button>
    </section>
  )
}
