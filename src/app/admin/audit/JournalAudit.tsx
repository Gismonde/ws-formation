'use client'

import { useT } from '@/lib/i18n/client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { LIBELLES_AUDIT, GROUPES_AUDIT, libelleAudit, type LigneAudit } from '@/lib/audit-journal-libelles'
import { CLINIQUE_INFO, type Clinique } from '@/lib/cliniques'

type EmployeOption = { id: string; nom: string; email: string; clinique: string | null; departement_id: string | null; actif: boolean }

const LIMITE = 50
const champ = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white'

export default function JournalAudit({ employes, departements, cliniques }: {
  employes: EmployeOption[]
  departements: { id: string; nom: string }[]
  cliniques: Clinique[]
}) {
  const { t } = useT()
  const [types, setTypes] = useState<string[]>([])
  const [clinique, setClinique] = useState('')
  const [departement, setDepartement] = useState('')
  const [choisis, setChoisis] = useState<string[]>([])
  const [rechercheEmp, setRechercheEmp] = useState('')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [recherche, setRecherche] = useState('')
  const [parEmploye, setParEmploye] = useState(true)
  const [page, setPage] = useState(1)
  const [logs, setLogs] = useState<LigneAudit[]>([])
  const [total, setTotal] = useState(0)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)

  const params = useMemo(() => {
    const p = new URLSearchParams()
    if (types.length) p.set('types', types.join(','))
    if (clinique) p.set('clinique', clinique)
    if (departement) p.set('departement', departement)
    if (choisis.length) p.set('employes', choisis.join(','))
    if (dateDebut) p.set('date_debut', dateDebut)
    if (dateFin) p.set('date_fin', dateFin)
    if (recherche.trim()) p.set('recherche', recherche.trim())
    return p
  }, [types, clinique, departement, choisis, dateDebut, dateFin, recherche])

  const charger = useCallback(async () => {
    setChargement(true); setErreur(null)
    const p = new URLSearchParams(params); p.set('page', String(page)); p.set('limit', String(LIMITE))
    const r = await fetch(`/api/audit-logs?${p}`)
    const d = await r.json().catch(() => ({}))
    if (r.ok) { setLogs(d.logs ?? []); setTotal(d.count ?? 0) } else setErreur(d.error ?? 'Chargement impossible')
    setChargement(false)
  }, [params, page])

  useEffect(() => { const t = setTimeout(charger, 250); return () => clearTimeout(t) }, [charger])
  useEffect(() => { setPage(1) }, [params])

  // Liste des employés proposée, réduite par clinique / département / recherche
  const proposes = useMemo(() => {
    const q = rechercheEmp.trim().toLowerCase()
    return employes.filter(e =>
      (!clinique || e.clinique === clinique || e.clinique === 'LES_DEUX') &&
      (!departement || e.departement_id === departement) &&
      (!q || e.nom.toLowerCase().includes(q) || e.email.toLowerCase().includes(q)))
  }, [employes, clinique, departement, rechercheEmp])
  const parId = useMemo(() => new Map(employes.map(e => [e.id, e])), [employes])

  const basculerType = (t: string) => setTypes(v => (v.includes(t) ? v.filter(x => x !== t) : [...v, t]))
  const basculerGroupe = (ts: string[]) => setTypes(v => (ts.every(t => v.includes(t)) ? v.filter(x => !ts.includes(x)) : Array.from(new Set([...v, ...ts]))))
  const basculerEmploye = (id: string) => setChoisis(v => (v.includes(id) ? v.filter(x => x !== id) : [...v, id]))
  const reinitialiser = () => { setTypes([]); setClinique(''); setDepartement(''); setChoisis([]); setDateDebut(''); setDateFin(''); setRecherche('') }

  const lienExport = (format: 'xlsx' | 'csv') => {
    const p = new URLSearchParams(params); p.set('format', format)
    if (parEmploye && choisis.length) p.set('par_employe', '1')
    return `/api/audit-logs/export?${p}`
  }
  const pages = Math.max(1, Math.ceil(total / LIMITE))

  return (
    <div className="max-w-7xl">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Journal d&apos;audit</h1>
          <p className="text-sm text-gray-500 mt-1">{total.toLocaleString('fr-CA')} événement{total > 1 ? 's' : ''}{' '}{t('— journal immuable, conservé 5 ans.')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {choisis.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-gray-700 mr-2">
              <input type="checkbox" checked={parEmploye} onChange={e => setParEmploye(e.target.checked)} />
              {choisis.length > 1 ? t('Séparer par employé (un onglet Excel / un CSV chacun)') : t('Fichier au nom de l’employé')}
            </label>
          )}
          <a href={lienExport('xlsx')} className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">{t('⬇ Excel')}</a>
          <a href={lienExport('csv')} className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">{t('⬇ CSV')}{parEmploye && choisis.length > 1 ? ' (ZIP)' : ''}</a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
        {/* Filtres */}
        <aside className="bg-white border border-gray-200 rounded-xl p-4 space-y-5 h-fit">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-gray-900 text-sm">{t('Filtres')}</h2>
            <button type="button" onClick={reinitialiser} className="text-xs text-indigo-600 hover:underline">{t('Tout effacer')}</button>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Type d&apos;événement {types.length > 0 && <span className="text-indigo-600">({types.length})</span>}</p>
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {GROUPES_AUDIT.map(g => {
                const tous = g.types.every(t => types.includes(t))
                return (
                  <div key={g.nom}>
                    <button type="button" onClick={() => basculerGroupe(g.types)} className={'text-xs font-semibold mb-1 ' + (tous ? 'text-indigo-700' : 'text-gray-700')}>
                      {tous ? '☑' : '☐'} {g.nom}
                    </button>
                    <div className="flex flex-wrap gap-1.5 pl-4">
                      {g.types.map(t => (
                        <button key={t} type="button" onClick={() => basculerType(t)}
                          className="text-[11px] px-2 py-1 rounded-full border transition"
                          style={types.includes(t) ? { background: LIBELLES_AUDIT[t].color, color: '#fff', borderColor: LIBELLES_AUDIT[t].color } : { background: '#fff', color: '#374151', borderColor: '#e5e7eb' }}>
                          {LIBELLES_AUDIT[t].label}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {cliniques.length > 1 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{t('Clinique')}</p>
              <select value={clinique} onChange={e => setClinique(e.target.value)} className={champ}>
                <option value="">{t('Toutes')}</option>
                {cliniques.map(c => <option key={c} value={c}>{CLINIQUE_INFO[c].nom}</option>)}
              </select>
            </div>
          )}

          {departements.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{t('Département')}</p>
              <select value={departement} onChange={e => setDepartement(e.target.value)} className={champ}>
                <option value="">{t('Tous')}</option>
                {departements.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}
              </select>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{t('Employés')}{' '}{choisis.length > 0 && <span className="text-indigo-600">({choisis.length})</span>}</p>
            {choisis.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {choisis.map(id => (
                  <button key={id} type="button" onClick={() => basculerEmploye(id)} className="text-[11px] px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {parId.get(id)?.nom ?? 'Employé'} ✕
                  </button>
                ))}
              </div>
            )}
            <input value={rechercheEmp} onChange={e => setRechercheEmp(e.target.value)} placeholder={t('Rechercher un employé…')} className={champ} />
            <div className="mt-2 max-h-56 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
              {proposes.length === 0 && <p className="text-xs text-gray-400 p-3">{t('Aucun employé')}</p>}
              {proposes.slice(0, 200).map(e => (
                <label key={e.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" checked={choisis.includes(e.id)} onChange={() => basculerEmploye(e.id)} />
                  <span className={'truncate ' + (e.actif ? 'text-gray-800' : 'text-gray-400')}>{e.nom || e.email}{!e.actif && ' (archivé)'}</span>
                </label>
              ))}
            </div>
            {proposes.length > 1 && (
              <div className="flex gap-3 mt-1.5">
                <button type="button" onClick={() => setChoisis(v => Array.from(new Set([...v, ...proposes.slice(0, 200).map(e => e.id)])))} className="text-xs text-indigo-600 hover:underline">Tout cocher ({Math.min(proposes.length, 200)})</button>
                {choisis.length > 0 && <button type="button" onClick={() => setChoisis([])} className="text-xs text-gray-500 hover:underline">{t('Aucun')}</button>}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="text-xs text-gray-500">{t('Du')}<input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} className={champ + ' mt-1'} /></label>
            <label className="text-xs text-gray-500">{t('Au')}<input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} className={champ + ' mt-1'} /></label>
          </div>
          <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder={t('🔍 Rechercher dans les descriptions…')} className={champ} />
        </aside>

        {/* Résultats */}
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden min-w-0">
          {erreur && <p className="text-sm text-red-600 p-4">{erreur}</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="bg-gray-50 text-xs uppercase text-gray-500">
                  <th className="text-left px-4 py-3 font-semibold">{t('Date')}</th>
                  <th className="text-left px-3 py-3 font-semibold">{t('Type')}</th>
                  <th className="text-left px-3 py-3 font-semibold">{t('Auteur')}</th>
                  <th className="text-left px-3 py-3 font-semibold">{t('Description')}</th>
                  <th className="text-left px-3 py-3 font-semibold">{t('IP')}</th>
                </tr>
              </thead>
              <tbody className={chargement ? 'opacity-50' : ''}>
                {!chargement && logs.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">{t('Aucun événement pour ces filtres.')}</td></tr>}
                {logs.map(l => {
                  const s = LIBELLES_AUDIT[l.type_action] ?? { color: '#374151', bg: '#f3f4f6' }
                  return (
                    <tr key={l.id} className="border-t border-gray-100 align-top">
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{new Date(l.created_at).toLocaleString('fr-CA', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td className="px-3 py-2.5"><span className="text-[11px] font-semibold px-2 py-1 rounded-full whitespace-nowrap" style={{ color: s.color, background: s.bg }}>{libelleAudit(l.type_action)}</span></td>
                      <td className="px-3 py-2.5">
                        {l.acteur ? <Link href={`/admin/employes/${l.acteur.id}`} className="text-gray-900 hover:underline">{l.acteur.prenom} {l.acteur.nom}</Link> : <span className="text-gray-400">{t('Système')}</span>}
                        {l.cible && l.cible.id !== l.acteur?.id && <div className="text-xs text-gray-400">→ {l.cible.prenom} {l.cible.nom}</div>}
                      </td>
                      <td className="px-3 py-2.5 text-gray-700">{l.description}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap">{l.ip_address?.split(',')[0] ?? ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm">
            <span className="text-gray-500">{t('Page')}{' '}{page} / {pages}</span>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40">{t('← Précédente')}</button>
              <button type="button" disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40">{t('Suivante →')}</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
