'use client'
// Journées de formation : lancer une journée (raison + contenu + employés) ou gérer les modèles réutilisables.
import { useT } from '@/lib/i18n/client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CLINIQUE_CONTENU_LABEL, type CliniqueContenu } from '@/lib/cliniques'
import type { Journee } from '@/lib/journees'

type Option = { id: string; titre: string; detail: string }
export type Suivi = { employe_id: string; nom: string; faits: number; total: number }

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const champ = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
const jourEn = (loc: string) => (d: string | null) => (d ? new Date(d + 'T12:00:00').toLocaleDateString(loc, { dateStyle: 'medium' }) : null)

function Selection({ titre, options, choisis, onChange, vide }: { titre: string; options: Option[]; choisis: string[]; onChange: (ids: string[]) => void; vide: string }) {
  const { t } = useT()
  const [q, setQ] = useState('')
  const visibles = useMemo(() => options.filter(o => !q || norm(o.titre + ' ' + o.detail).includes(norm(q))), [options, q])
  const basculer = (id: string) => onChange(choisis.includes(id) ? choisis.filter(x => x !== id) : [...choisis, id])
  return (
    <div className="border border-gray-200 rounded-xl bg-white flex flex-col min-h-0">
      <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-800 flex-1">{titre} <span className="text-gray-400 font-normal">({choisis.length})</span></span>
        {choisis.length > 0 && <button type="button" onClick={() => onChange([])} className="text-xs text-gray-500 hover:text-gray-800">{t('Tout retirer')}</button>}
      </div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('Rechercher…')} className="mx-3 mt-2 border border-gray-200 rounded-lg px-2 py-1 text-sm" />
      <ul className="overflow-y-auto max-h-64 py-1">
        {visibles.length === 0 && <li className="px-3 py-3 text-xs text-gray-400">{vide}</li>}
        {visibles.map(o => (
          <li key={o.id}>
            <label className="flex items-start gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" checked={choisis.includes(o.id)} onChange={() => basculer(o.id)} className="mt-1" />
              <span className="min-w-0"><span className="block text-sm text-gray-900">{o.titre}</span>{o.detail && <span className="block text-xs text-gray-400">{o.detail}</span>}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function JourneesClient({ migration, raisons, cliniques, journees, suivi, politiquesPermises, formations, politiques, librairie, employes }: {
  migration: boolean
  raisons: string[]
  cliniques: CliniqueContenu[]
  journees: Journee[]
  suivi: Record<string, Suivi[]>
  politiquesPermises: boolean
  formations: Option[]
  politiques: Option[]
  librairie: Option[]
  employes: Option[]
}) {
  const { t, loc } = useT()
  const jour = jourEn(loc)
  const router = useRouter()
  const modeles = journees.filter(j => j.modele)
  const lancees = journees.filter(j => !j.modele)
  const vierge = { raison: raisons[0], autre: '', nom: '', clinique: cliniques.includes('LES_DEUX') ? 'LES_DEUX' as CliniqueContenu : cliniques[0], formation_ids: [] as string[], politique_ids: [] as string[], librairie_ids: [] as string[], employe_ids: [] as string[], date_journee: '', date_echeance: '', note: '' }
  const [f, setF] = useState(vierge)
  const [modeleId, setModeleId] = useState('')
  const [enEdition, setEnEdition] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null)
  const [ouverte, setOuverte] = useState<string | null>(null)

  const raisonFinale = f.raison === 'Autre' ? f.autre.trim() : f.raison
  const titreDe = (liste: Option[], ids: string[]) => ids.map(id => liste.find(o => o.id === id)?.titre).filter(Boolean) as string[]

  const partirDe = (id: string) => {
    setModeleId(id)
    const m = journees.find(j => j.id === id)
    if (!m) return
    const connue = raisons.includes(m.raison)
    setF(x => ({ ...x, raison: connue ? m.raison : 'Autre', autre: connue ? '' : m.raison, nom: m.nom, clinique: m.clinique,
      formation_ids: m.formation_ids.filter(i => formations.some(o => o.id === i)),
      politique_ids: m.politique_ids.filter(i => politiques.some(o => o.id === i)),
      librairie_ids: m.librairie_ids.filter(i => librairie.some(o => o.id === i)), note: m.note ?? '' }))
  }

  const envoyer = async (modele: boolean, miseAJour = false) => {
    setEnvoi(true); setMessage(null)
    const r = await fetch(miseAJour && enEdition ? `/api/admin/journees/${enEdition}` : '/api/admin/journees', {
      method: miseAJour && enEdition ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...f, raison: raisonFinale, nom: f.nom.trim() || raisonFinale, modele }),
    })
    const d = await r.json().catch(() => ({}))
    setEnvoi(false)
    if (!r.ok) { setMessage({ ok: false, texte: d.error ?? t('Erreur') }); return }
    if (modele) { setMessage({ ok: true, texte: t('Modèle « {nom} » enregistré.', { nom: d.journee.nom }) }); setEnEdition(null) }
    else {
      const nf = (d.formations as { creees: number }[]).reduce((s, x) => s + x.creees, 0)
      const np = (d.politiques as { ajoutes: number }[]).reduce((s, x) => s + x.ajoutes, 0)
      setMessage({ ok: true, texte: t('Journée lancée pour {n} employé(s) : {f} assignation(s) de formation, {p} politique(s) ajoutée(s).', { n: d.employes, f: nf, p: np }) + (d.courriels ? ' ' + t('{n} courriel(s) envoyé(s)', { n: d.courriels }) : '') })
      setF(x => ({ ...x, employe_ids: [], date_journee: '', date_echeance: '' }))
    }
    router.refresh()
  }

  const supprimer = async (j: Journee) => {
    setMessage(null)
    const r = await fetch(`/api/admin/journees/${j.id}`, { method: 'DELETE' })
    if (!r.ok) { const d = await r.json().catch(() => ({})); setMessage({ ok: false, texte: d.error ?? t('Erreur') }); return }
    router.refresh()
  }

  const contenu = f.formation_ids.length + f.politique_ids.length + f.librairie_ids.length
  if (migration) return <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{t('Exécutez d’abord')} <code>{t('supabase/migrations/journees_formation.sql')}</code> {t('dans Supabase.')}</div>

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold text-gray-900">{t('Journées de formation')}</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6 max-w-3xl">
        Lancez une journée pour un ou plusieurs employés : choisissez la raison (embauche, retour à l’emploi…), puis les formations,
        les politiques à lire et les éléments de la librairie à visionner. Les formations et politiques sont assignées automatiquement,
        et chaque employé reçoit un seul courriel et une page « Ma journée de formation » qui suit son avancement.
      </p>

      <section className="bg-white border border-gray-200 rounded-2xl p-5 mb-8">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Partir d’un modèle')}</label>
            <select value={modeleId} onChange={e => partirDe(e.target.value)} className={champ}>
              <option value="">{t('— Aucun —')}</option>
              {modeles.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Raison *')}</label>
            <select value={f.raison} onChange={e => setF({ ...f, raison: e.target.value })} className={champ}>
              {[...raisons, 'Autre'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {f.raison === 'Autre' && <input value={f.autre} onChange={e => setF({ ...f, autre: e.target.value })} placeholder={t('Précisez la raison')} className={champ + ' mt-2'} maxLength={120} />}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Nom de la journée')}</label>
            <input value={f.nom} onChange={e => setF({ ...f, nom: e.target.value })} placeholder={raisonFinale || t('Ex. : Embauche — infirmières')} className={champ} maxLength={160} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Clinique')}</label>
            <select value={f.clinique} onChange={e => setF({ ...f, clinique: e.target.value as CliniqueContenu })} className={champ}>
              {cliniques.map(c => <option key={c} value={c}>{CLINIQUE_CONTENU_LABEL[c]}</option>)}
            </select>
          </div>
        </div>

        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mt-6 mb-2">{t('1. Contenu de la journée')}</h2>
        <div className={'grid gap-4 ' + (politiquesPermises ? 'md:grid-cols-3' : 'md:grid-cols-2')}>
          <Selection titre={t('🎓 Formations à compléter')} options={formations} choisis={f.formation_ids} onChange={ids => setF({ ...f, formation_ids: ids })} vide={t('Aucune formation')} />
          {politiquesPermises && <Selection titre={t('📜 Politiques à lire et confirmer')} options={politiques} choisis={f.politique_ids} onChange={ids => setF({ ...f, politique_ids: ids })} vide={t('Aucune politique')} />}
          <Selection titre={t('📚 Informations à visionner (librairie)')} options={librairie} choisis={f.librairie_ids} onChange={ids => setF({ ...f, librairie_ids: ids })} vide={t('Aucun élément')} />
        </div>
        <div className="mt-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('Message aux employés (optionnel)')}</label>
          <textarea value={f.note} onChange={e => setF({ ...f, note: e.target.value })} rows={2} maxLength={1000} className={champ} placeholder={t('Ex. : Présentez-vous à 8 h à la réception ; la journée se termine vers 15 h.')} />
        </div>
        <div className="mt-3 flex flex-wrap justify-end items-center gap-2">
          {enEdition && (
            <>
              <span className="text-sm text-amber-700 mr-auto">✏️ {t('Modification du modèle « {nom} »', { nom: modeles.find(m => m.id === enEdition)?.nom ?? '' })}</span>
              <button type="button" onClick={() => setEnEdition(null)} className="text-sm px-3 py-2 text-gray-600">{t('Annuler la modification')}</button>
              <button type="button" disabled={envoi || !raisonFinale || contenu === 0} onClick={() => envoyer(true, true)}
                className="text-sm font-semibold px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-40">
                {t('Mettre à jour le modèle')}
              </button>
            </>
          )}
          <button type="button" disabled={envoi || !raisonFinale || contenu === 0} onClick={() => envoyer(true)}
            className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40">
            {enEdition ? t('Enregistrer comme nouveau modèle') : t('Enregistrer comme modèle')}
          </button>
        </div>

        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mt-6 mb-2">{t('2. Employés et dates')}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <Selection titre={t('👥 Employés')} options={employes} choisis={f.employe_ids} onChange={ids => setF({ ...f, employe_ids: ids })} vide={t('Aucun employé')} />
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Date de la journée')}</label>
              <input type="date" value={f.date_journee} onChange={e => setF({ ...f, date_journee: e.target.value })} className={champ} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('À compléter avant le')}</label>
              <input type="date" value={f.date_echeance} onChange={e => setF({ ...f, date_echeance: e.target.value })} className={champ} />
            </div>
            <button type="button" disabled={envoi || !raisonFinale || contenu === 0 || f.employe_ids.length === 0} onClick={() => envoyer(false)}
              className="w-full text-sm font-semibold px-4 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40">
              {envoi ? t('Lancement…') : t('Lancer la journée ({n} employé(s))', { n: f.employe_ids.length })}
            </button>
            <p className="text-xs text-gray-500">{contenu} élément(s) : {f.formation_ids.length} formation(s), {f.politique_ids.length} politique(s), {f.librairie_ids.length}{' '}{t('à visionner.')}</p>
          </div>
        </div>
        {message && <p className={'mt-4 text-sm rounded-lg px-3 py-2 ' + (message.ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200')}>{message.texte}</p>}
      </section>

      <h2 className="text-lg font-semibold text-gray-900 mb-3">{t('Modèles')}</h2>
      {modeles.length === 0 ? <p className="text-sm text-gray-400 mb-8">{t('Aucun modèle. Composez une journée puis « Enregistrer comme modèle ».')}</p> : (
        <div className="grid gap-3 md:grid-cols-2 mb-8">
          {modeles.map(m => (
            <div key={m.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-gray-900">{m.nom}</div>
                  <div className="text-xs text-gray-500">{m.raison} · {CLINIQUE_CONTENU_LABEL[m.clinique]} · {m.formation_ids.length} formation(s), {m.politique_ids.length} politique(s), {m.librairie_ids.length}{' '}{t('à visionner')}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => { partirDe(m.id); setEnEdition(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="text-xs font-semibold text-blue-600">{t('Utiliser')}</button>
                  <button onClick={() => { partirDe(m.id); setEnEdition(m.id); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="text-xs font-semibold text-amber-700">{t('Modifier')}</button>
                  <button onClick={() => supprimer(m)} className="text-xs text-red-600">{t('Supprimer')}</button>
                </div>
              </div>
              <ul className="mt-2 text-xs text-gray-600 list-disc pl-4">
                {[...titreDe(formations, m.formation_ids), ...titreDe(politiques, m.politique_ids), ...titreDe(librairie, m.librairie_ids)].map(t => <li key={t}>{t}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-lg font-semibold text-gray-900 mb-3">{t('Journées lancées')}</h2>
      {lancees.length === 0 ? <p className="text-sm text-gray-400">{t('Aucune journée lancée.')}</p> : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead><tr className="bg-gray-50 text-xs uppercase text-gray-500 text-left">
              <th className="px-4 py-2.5">{t('Journée')}</th><th className="px-3 py-2.5">{t('Date')}</th><th className="px-3 py-2.5">{t('Échéance')}</th><th className="px-3 py-2.5">{t('Employés')}</th><th className="px-3 py-2.5">{t('Complétées')}</th><th></th>
            </tr></thead>
            <tbody>
              {lancees.map(j => {
                const s = suivi[j.id] ?? []
                const finis = s.filter(x => x.total > 0 && x.faits === x.total).length
                return (
                  <FragmentLigne key={j.id} ouverte={ouverte === j.id}>
                    <tr className="border-t border-gray-100 cursor-pointer hover:bg-gray-50" onClick={() => setOuverte(ouverte === j.id ? null : j.id)}>
                      <td className="px-4 py-2.5"><div className="font-medium text-gray-900">{j.nom}</div><div className="text-xs text-gray-500">{j.raison}</div></td>
                      <td className="px-3 py-2.5 text-gray-600">{jour(j.date_journee) ?? '—'}</td>
                      <td className="px-3 py-2.5 text-gray-600">{jour(j.date_echeance) ?? '—'}</td>
                      <td className="px-3 py-2.5 text-gray-600">{j.employe_ids.length}</td>
                      <td className="px-3 py-2.5"><span className={'text-xs font-semibold px-2 py-1 rounded-full ' + (finis === s.length && s.length ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700')}>{finis}/{s.length}</span></td>
                      <td className="px-3 py-2.5 text-right text-xs text-gray-400">{ouverte === j.id ? '▲' : '▼'}</td>
                    </tr>
                    {ouverte === j.id && (
                      <tr className="bg-gray-50/60"><td colSpan={6} className="px-4 py-3">
                        <ul className="grid gap-1 md:grid-cols-2 text-sm">
                          {s.map(x => <li key={x.employe_id} className="flex justify-between gap-3"><span>{x.nom}</span><span className="text-gray-500">{x.faits}/{x.total} {x.total ? '' : '(visionnement seulement)'}</span></li>)}
                        </ul>
                        <div className="mt-3 flex justify-end"><button onClick={() => supprimer(j)} className="text-xs text-red-600">Retirer de la liste (les assignations restent)</button></div>
                      </td></tr>
                    )}
                  </FragmentLigne>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function FragmentLigne({ children }: { children: React.ReactNode; ouverte: boolean }) {
  return <>{children}</>
}
