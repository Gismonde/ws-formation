'use client'
// Administration des badges : réglage des badges intégrés (administrateur global) et badges des cliniques.
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n/client'
import { CLINIQUE_CONTENU_LABEL, type CliniqueContenu } from '@/lib/cliniques'
import type { BadgePerso, ReglageBadge, BADGES_INTEGRES } from '@/lib/badges'

type Integre = (typeof BADGES_INTEGRES)[number]
const champ = 'border border-gray-300 rounded-lg px-2 py-1.5 text-sm'
const ICONES = ['⭐', '🏅', '🎖️', '🏆', '🩺', '💉', '🧼', '🦺', '🛡️', '🔐', '🚑', '❤️', '🧠', '🤝', '📚', '🌟']

async function appel(method: string, corps?: unknown, query = '') {
  const r = await fetch('/api/admin/badges' + query, { method, headers: { 'Content-Type': 'application/json' }, body: corps ? JSON.stringify(corps) : undefined })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'Erreur')
}

function LigneIntegre({ b, r, modifiable }: { b: Integre; r?: ReglageBadge; modifiable: boolean }) {
  const { t } = useT()
  const router = useRouter()
  const [actif, setActif] = useState(r?.actif !== false)
  const [icone, setIcone] = useState(r?.icone ?? '')
  const [titre, setTitre] = useState(r?.titre ?? '')
  const [description, setDescription] = useState(r?.description ?? '')
  const [seuils, setSeuils] = useState((r?.seuils ?? b.seuils ?? []).join(', '))
  const [etat, setEtat] = useState<string | null>(null)
  const enregistrer = async (actifVoulu = actif) => {
    setEtat('…')
    try {
      await appel('PUT', { cle: b.cle, actif: actifVoulu, icone, titre, description, seuils: seuils.split(/[,;\s]+/).filter(Boolean).map(Number) })
      setEtat('✓'); router.refresh()
    } catch (e) { setEtat(e instanceof Error ? e.message : t('Erreur')) }
  }
  return (
    <li className={'p-4 ' + (actif ? '' : 'opacity-60')}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-2xl w-8 text-center">{icone || b.icone}</span>
        <div className="flex-1 min-w-[200px]">
          <p className="font-semibold text-gray-900 text-sm">{titre || t(b.titre)}</p>
          <p className="text-xs text-gray-500">{description || t(b.description, { n: (b.seuils ?? [])[0] ?? '' })}</p>
        </div>
        {modifiable && (
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={actif} onChange={e => { setActif(e.target.checked); enregistrer(e.target.checked) }} /> {t('Actif')}
          </label>
        )}
      </div>
      {modifiable && actif && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          {!b.multiples && (
            <>
              <input value={icone} onChange={e => setIcone(e.target.value)} placeholder={b.icone} className={champ + ' w-16 text-center'} aria-label={t('Icône')} />
              <input value={titre} onChange={e => setTitre(e.target.value)} placeholder={t(b.titre)} maxLength={80} className={champ + ' w-48'} aria-label={t('Nom')} />
              <input value={description} onChange={e => setDescription(e.target.value)} placeholder={t('Description (laisser vide = texte par défaut)')} maxLength={200} className={champ + ' flex-1 min-w-[200px]'} />
            </>
          )}
          {b.seuils && (
            <label className="text-xs text-gray-600">
              {b.multiples ? t('Seuils (séparés par des virgules)') : t('Seuil')}
              <input value={seuils} onChange={e => setSeuils(e.target.value)} className={champ + ' block w-40 mt-0.5'} />
            </label>
          )}
          <button type="button" onClick={() => enregistrer()} className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 text-white">{t('Enregistrer')}</button>
          {etat && <span className={'text-xs ' + (etat === '✓' ? 'text-green-700' : 'text-gray-600')}>{etat === '✓' ? '✓ ' + t('Enregistré') : etat}</span>}
        </div>
      )}
    </li>
  )
}

function FormulairePerso({ initial, formations, cliniques, onFini }: { initial?: BadgePerso; formations: { id: string; titre: string; clinique: string }[]; cliniques: CliniqueContenu[]; onFini: () => void }) {
  const { t } = useT()
  const [f, setF] = useState({ nom: initial?.nom ?? '', description: initial?.description ?? '', icone: initial?.icone ?? '⭐', clinique: (initial?.clinique ?? cliniques[0]) as string, formation_ids: initial?.formation_ids ?? [] as string[], actif: initial?.actif ?? true })
  const [q, setQ] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const visibles = useMemo(() => formations.filter(x => !q || x.titre.toLowerCase().includes(q.toLowerCase())), [formations, q])
  const envoyer = async () => {
    setEnvoi(true); setErreur(null)
    try { await appel(initial ? 'PATCH' : 'POST', { ...f, id: initial?.id }); onFini() }
    catch (e) { setErreur(e instanceof Error ? e.message : t('Erreur')) }
    setEnvoi(false)
  }
  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
      <div className="flex flex-wrap gap-1">
        {ICONES.map(i => <button key={i} type="button" onClick={() => setF({ ...f, icone: i })} aria-pressed={f.icone === i} className={'text-xl w-9 h-9 rounded-lg border ' + (f.icone === i ? 'border-indigo-500 bg-white' : 'border-transparent hover:bg-white')}>{i}</button>)}
      </div>
      <div className="grid sm:grid-cols-3 gap-2">
        <input value={f.nom} onChange={e => setF({ ...f, nom: e.target.value })} placeholder={t('Nom du badge * (ex. : Expert bloc opératoire)')} maxLength={80} className={champ} />
        <input value={f.description} onChange={e => setF({ ...f, description: e.target.value })} placeholder={t('Description (facultatif)')} maxLength={200} className={champ} />
        <select value={f.clinique} onChange={e => setF({ ...f, clinique: e.target.value })} className={champ}>
          {cliniques.map(c => <option key={c} value={c}>{t(CLINIQUE_CONTENU_LABEL[c])}</option>)}
        </select>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800 flex-1">{t('Formations à terminer pour obtenir le badge')} ({f.formation_ids.length})</span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('Rechercher…')} className="border border-gray-200 rounded-lg px-2 py-1 text-sm" />
        </div>
        <ul className="max-h-56 overflow-y-auto py-1">
          {visibles.map(x => (
            <li key={x.id}><label className="flex items-center gap-2 px-3 py-1 text-sm hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" checked={f.formation_ids.includes(x.id)} onChange={() => setF({ ...f, formation_ids: f.formation_ids.includes(x.id) ? f.formation_ids.filter(i => i !== x.id) : [...f.formation_ids, x.id] })} />
              {x.titre} <span className="text-xs text-gray-400">{x.clinique === 'LES_DEUX' ? 'CMC + WSSC' : x.clinique}</span>
            </label></li>
          ))}
        </ul>
      </div>
      {erreur && <p className="text-sm text-red-600">{erreur}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onFini} className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 bg-white">{t('Annuler')}</button>
        <button type="button" onClick={envoyer} disabled={envoi || !f.nom.trim() || f.formation_ids.length === 0} className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 text-white disabled:opacity-40">{initial ? t('Enregistrer') : t('Créer le badge')}</button>
      </div>
    </div>
  )
}

export default function BadgesAdmin({ integres, reglages, perso, formations, peutReglerIntegres, cliniques }: {
  integres: Integre[]; reglages: Record<string, ReglageBadge>; perso: BadgePerso[]
  formations: { id: string; titre: string; clinique: string }[]; peutReglerIntegres: boolean; cliniques: CliniqueContenu[]
}) {
  const { t } = useT()
  const router = useRouter()
  const [edition, setEdition] = useState<string | 'nouveau' | null>(null)
  const fini = () => { setEdition(null); router.refresh() }
  const supprimer = async (p: BadgePerso) => {
    try { await appel('DELETE', undefined, '?id=' + p.id); router.refresh() } catch { /* */ }
  }
  const titreFormation = (id: string) => formations.find(f => f.id === id)?.titre
  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">{t('Badges de la clinique')}</h2>
          {edition !== 'nouveau' && cliniques.length > 0 && <button type="button" onClick={() => setEdition('nouveau')} className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 text-white">+ {t('Créer un badge')}</button>}
        </div>
        {edition === 'nouveau' && <FormulairePerso formations={formations} cliniques={cliniques} onFini={fini} />}
        {perso.length === 0 && edition !== 'nouveau' && <p className="text-sm text-gray-400">{t('Aucun badge créé. Exemple : « Expert bloc opératoire » pour qui termine les 4 formations du bloc.')}</p>}
        <ul className="space-y-2 mt-3">
          {perso.map(p => edition === p.id ? <li key={p.id}><FormulairePerso initial={p} formations={formations} cliniques={cliniques} onFini={fini} /></li> : (
            <li key={p.id} className={'bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center gap-3 ' + (p.actif ? '' : 'opacity-60')}>
              <span className="text-2xl">{p.icone}</span>
              <div className="flex-1 min-w-[200px]">
                <p className="font-semibold text-gray-900 text-sm">{p.nom} <span className="text-xs font-normal text-gray-400">· {p.clinique === 'LES_DEUX' ? 'CMC + WSSC' : p.clinique}</span></p>
                <p className="text-xs text-gray-500">{p.description || t('{n} formation(s) à terminer', { n: p.formation_ids.length })}</p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{p.formation_ids.map(titreFormation).filter(Boolean).join(' · ')}</p>
              </div>
              {cliniques.includes(p.clinique as CliniqueContenu) && (
                <>
                  <button type="button" onClick={() => setEdition(p.id)} className="text-sm text-indigo-700 hover:underline">{t('Modifier')}</button>
                  <button type="button" onClick={() => supprimer(p)} className="text-sm text-gray-400 hover:text-red-600">{t('Supprimer')}</button>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">{t('Badges intégrés')}</h2>
        <p className="text-sm text-gray-500 mb-3">{peutReglerIntegres ? t('Activez ou désactivez chaque badge, changez son icône, son nom ou ses seuils. Les réglages valent pour les deux cliniques.') : t('Seul l’administrateur global peut régler les badges intégrés.')}</p>
        <ul className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100">
          {integres.map(b => <LigneIntegre key={b.cle} b={b} r={reglages[b.cle]} modifiable={peutReglerIntegres} />)}
        </ul>
      </section>
    </div>
  )
}
