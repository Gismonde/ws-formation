'use client'
// Assignation groupée : 1) quoi (formations ou politiques), 2) à qui (employés, départements, clinique), 3) options.
import { useT } from '@/lib/i18n/client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CLINIQUE_INFO, type Clinique } from '@/lib/cliniques'

type Element = { id: string; titre: string; detail: string; obligatoire?: boolean }
type Employe = { id: string; nom: string; clinique: string; departement_id: string | null; departement: string }
type Props = {
  formations: Element[]
  politiques: Element[]
  employes: Employe[]
  departements: { id: string; nom: string }[]
  cliniques: Clinique[]
  politiquesPermises: boolean
  preselection: { formations: string[]; politiques: string[]; employes: string[] }
}
type Resultat = {
  quoi: 'formations' | 'politiques'
  employes: number
  courriels: number
  resultats: { titre: string; creees?: number; ajoutes?: number; deja: number; autre_clinique: number; elargie?: boolean; refusee?: string }[]
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function ListeCochable<T extends { id: string }>({ items, choisis, setChoisis, rendu, filtre, placeholder }: {
  items: T[]; choisis: Set<string>; setChoisis: (s: Set<string>) => void
  rendu: (t: T) => React.ReactNode; filtre: (t: T) => string; placeholder: string
}) {
  const { t } = useT()
  const [q, setQ] = useState('')
  const visibles = useMemo(() => items.filter(t => !q || norm(filtre(t)).includes(norm(q))), [items, q, filtre])
  const tousVisibles = visibles.length > 0 && visibles.every(t => choisis.has(t.id))
  function basculer(id: string) {
    const s = new Set(choisis); if (s.has(id)) s.delete(id); else s.add(id); setChoisis(s)
  }
  function basculerTout() {
    const s = new Set(choisis)
    for (const t of visibles) { if (tousVisibles) s.delete(t.id); else s.add(t.id) }
    setChoisis(s)
  }
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 p-2 bg-gray-50 border-b border-gray-200">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder}
          className="flex-1 min-w-[160px] border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
        <button type="button" onClick={basculerTout} className="text-xs font-semibold text-indigo-700 px-2">
          {tousVisibles ? t('Tout décocher') : `Tout cocher (${visibles.length})`}
        </button>
      </div>
      <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
        {visibles.length === 0 && <p className="p-4 text-sm text-gray-400 text-center">{t('Aucun résultat.')}</p>}
        {visibles.map(t => (
          <label key={t.id} className={'flex items-start gap-3 px-3 py-2 cursor-pointer text-sm ' + (choisis.has(t.id) ? 'bg-indigo-50' : 'hover:bg-gray-50')}>
            <input type="checkbox" className="mt-0.5" checked={choisis.has(t.id)} onChange={() => basculer(t.id)} />
            <span className="flex-1 min-w-0">{rendu(t)}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

export default function AssignationGroupee(p: Props) {
  const { t } = useT()
  const [quoi, setQuoi] = useState<'formations' | 'politiques'>(p.preselection.politiques.length && p.politiquesPermises ? 'politiques' : 'formations')
  const [formations, setFormations] = useState(new Set(p.preselection.formations))
  const [politiques, setPolitiques] = useState(new Set(p.preselection.politiques))
  const [typeCible, setTypeCible] = useState<'employes' | 'departements' | 'clinique'>('employes')
  const [employes, setEmployes] = useState(new Set(p.preselection.employes))
  const [departements, setDepartements] = useState(new Set<string>())
  const [clinique, setClinique] = useState<Clinique | ''>(p.cliniques.length === 1 ? p.cliniques[0] : '')
  const [echeance, setEcheance] = useState('')
  const [notifier, setNotifier] = useState(true)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [resultat, setResultat] = useState<Resultat | null>(null)

  const choisis = quoi === 'formations' ? formations : politiques
  const nbCible = typeCible === 'employes' ? employes.size : typeCible === 'departements' ? departements.size : clinique ? 1 : 0
  const pret = choisis.size > 0 && nbCible > 0 && !enCours

  const nbParDept = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of p.employes) if (e.departement_id) m.set(e.departement_id, (m.get(e.departement_id) ?? 0) + 1)
    return m
  }, [p.employes])

  async function assigner() {
    setEnCours(true); setErreur(null); setResultat(null)
    const cible = typeCible === 'clinique' ? { type: 'clinique', clinique }
      : { type: typeCible, ids: Array.from(typeCible === 'employes' ? employes : departements) }
    const r = await fetch('/api/admin/assignations-groupees', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quoi, ids: Array.from(choisis), cible, dateEcheance: quoi === 'formations' && echeance ? echeance : null, notifier }),
    })
    const d = await r.json().catch(() => ({}))
    setEnCours(false)
    if (!r.ok) return setErreur(d.error ?? 'Assignation impossible')
    setResultat(d)
  }

  const onglet = (actif: boolean) => 'px-4 py-2 rounded-lg text-sm font-semibold border ' + (actif ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300')
  const etape = 'bg-white border border-gray-200 rounded-2xl p-5 space-y-3'

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('Assigner en groupe')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('Plusieurs formations ou politiques, à des employés, des départements ou toute une clinique. Les assignations existantes ne sont pas dupliquées.')}</p>
      </div>

      {/* 1. Quoi */}
      <section className={etape}>
        <h2 className="font-semibold text-gray-900">{t('1. Quoi assigner')}</h2>
        {p.politiquesPermises && (
          <div className="flex gap-2">
            <button type="button" className={onglet(quoi === 'formations')} onClick={() => { setQuoi('formations'); setResultat(null) }}>Formations ({formations.size})</button>
            <button type="button" className={onglet(quoi === 'politiques')} onClick={() => { setQuoi('politiques'); setResultat(null) }}>Politiques ({politiques.size})</button>
          </div>
        )}
        {quoi === 'formations' ? (
          <ListeCochable items={p.formations} choisis={formations} setChoisis={setFormations} placeholder={t('Rechercher une formation…')}
            filtre={f => f.titre + ' ' + f.detail}
            rendu={f => <><span className="font-medium text-gray-900">{f.titre}</span>{f.obligatoire && <span className="ml-2 text-[10px] font-bold uppercase text-red-600">{t('Obligatoire')}</span>}<span className="block text-xs text-gray-500">{f.detail}</span></>} />
        ) : (
          <ListeCochable items={p.politiques} choisis={politiques} setChoisis={setPolitiques} placeholder={t('Rechercher une politique…')}
            filtre={x => x.titre}
            rendu={x => <><span className="font-medium text-gray-900">{x.titre}</span><span className="block text-xs text-gray-500">{x.detail}</span></>} />
        )}
      </section>

      {/* 2. À qui */}
      <section className={etape}>
        <h2 className="font-semibold text-gray-900">{t('2. À qui')}</h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={onglet(typeCible === 'employes')} onClick={() => setTypeCible('employes')}>Employés ({employes.size})</button>
          <button type="button" className={onglet(typeCible === 'departements')} onClick={() => setTypeCible('departements')}>Départements ({departements.size})</button>
          {p.cliniques.length > 0 && <button type="button" className={onglet(typeCible === 'clinique')} onClick={() => setTypeCible('clinique')}>{t('Toute une clinique')}</button>}
        </div>
        {typeCible === 'employes' && (
          <ListeCochable items={p.employes} choisis={employes} setChoisis={setEmployes} placeholder={t('Rechercher un employé, un département…')}
            filtre={e => `${e.nom} ${e.departement} ${e.clinique}`}
            rendu={e => <><span className="font-medium text-gray-900">{e.nom}</span><span className="block text-xs text-gray-500">{[e.departement, e.clinique].filter(Boolean).join(' · ')}</span></>} />
        )}
        {typeCible === 'departements' && (
          <ListeCochable items={p.departements} choisis={departements} setChoisis={setDepartements} placeholder={t('Rechercher un département…')}
            filtre={d => d.nom}
            rendu={d => <><span className="font-medium text-gray-900">{d.nom}</span><span className="block text-xs text-gray-500">{nbParDept.get(d.id) ?? 0} employé(s) actif(s)</span></>} />
        )}
        {typeCible === 'clinique' && (
          <div className="flex flex-wrap gap-2">
            {p.cliniques.map(c => (
              <label key={c} className={'flex items-center gap-2 border rounded-xl px-4 py-3 cursor-pointer ' + (clinique === c ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200')}>
                <input type="radio" name="clinique" checked={clinique === c} onChange={() => setClinique(c)} />
                <span className="font-medium">{CLINIQUE_INFO[c].nom}</span>
              </label>
            ))}
            <p className="w-full text-xs text-gray-500">
              {quoi === 'formations'
                ? t('Tous les employés actifs de la clinique (y compris ceux rattachés aux deux cliniques). Les futurs employés ne sont pas inclus automatiquement.')
                : t('La politique s’adressera à toute la clinique, y compris aux futurs employés.')}
            </p>
          </div>
        )}
        {quoi === 'politiques' && typeCible !== 'clinique' && (
          <p className="text-xs text-gray-500">{t('La politique s’ajoutera pour ces')}{' '}{typeCible === 'employes' ? 'employés' : 'départements'} ; ceux qui la voient déjà ne sont pas touchés.</p>
        )}
      </section>

      {/* 3. Options */}
      <section className={etape}>
        <h2 className="font-semibold text-gray-900">{t('3. Options')}</h2>
        {quoi === 'formations' && (
          <label className="block text-sm">
            <span className="text-gray-700 font-medium">Date d’échéance (facultatif)</span>
            <input type="date" value={echeance} onChange={e => setEcheance(e.target.value)} className="block mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </label>
        )}
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={notifier} onChange={e => setNotifier(e.target.checked)} />
          Avertir les employés par courriel (un seul courriel par employé)
        </label>
      </section>

      {erreur && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{erreur}</div>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={assigner} disabled={!pret}
          className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold disabled:opacity-40">
          {enCours ? 'Assignation…' : `Assigner ${choisis.size} ${quoi === 'formations' ? 'formation(s)' : 'politique(s)'}`}
        </button>
        {!pret && !enCours && <span className="text-sm text-gray-500">{t('Choisissez au moins un élément et une cible.')}</span>}
      </div>

      {resultat && (
        <section className="bg-green-50 border border-green-200 rounded-2xl p-5">
          <h2 className="font-semibold text-green-900 mb-2">{t('Assignation terminée')}</h2>
          <p className="text-sm text-green-800 mb-3">
            {t('{n} employé(s) visé(s)', { n: resultat.employes })}{resultat.courriels ? ' · ' + t('{n} courriel(s) envoyé(s)', { n: resultat.courriels }) : ''}.
          </p>
          <ul className="space-y-1.5 text-sm">
            {resultat.resultats.map((r, i) => (
              <li key={i} className="bg-white rounded-lg px-3 py-2 border border-green-100">
                <span className="font-medium text-gray-900">{r.titre}</span>{' — '}
                {r.refusee ? <span className="text-red-600">{r.refusee}</span> : (
                  <span className="text-gray-700">
                    {resultat.quoi === 'formations' ? t('{n} nouvelle(s) assignation(s)', { n: r.creees ?? 0 }) : t('{n} employé(s) ajouté(s)', { n: r.ajoutes ?? 0 })}
                    {r.deja ? ' · ' + (resultat.quoi === 'formations' ? t('{n} déjà assigné(s)', { n: r.deja }) : t('{n} déjà visé(s)', { n: r.deja })) : ''}
                    {r.autre_clinique ? ' · ' + t('{n} ignoré(s) (autre clinique)', { n: r.autre_clinique }) : ''}
                    {r.elargie ? ' · ' + t('politique étendue à toute la clinique') : ''}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <Link href={resultat.quoi === 'formations' ? '/admin/conformite' : '/admin/politiques'} className="inline-block mt-3 text-sm font-semibold text-green-800 underline">
            {resultat.quoi === 'formations' ? t('Voir la conformité →') : t('Voir les politiques →')}
          </Link>
        </section>
      )}
    </div>
  )
}
