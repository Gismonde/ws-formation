'use client'
// Choix de la catégorie d'une politique, avec création d'une nouvelle catégorie sur place.
// Choisir une catégorie ajoute ses départements associés au public ciblé (ciblage automatique).
import { useState } from 'react'
import { useT } from '@/lib/i18n/client'
import { EMOJIS_CATEGORIE, libelleCategorie, normaliserCode, type CategoriePolitique } from '@/lib/politiques-categories'

export function FormCategorie({ initiale, departements, onEnregistree, onAnnuler }: {
  initiale?: CategoriePolitique
  departements: { id: string; nom: string }[]
  onEnregistree: (c: CategoriePolitique) => void
  onAnnuler: () => void
}) {
  const { t } = useT()
  const [code, setCode] = useState(initiale?.code ?? '')
  const [nom, setNom] = useState(initiale?.nom ?? '')
  const [emoji, setEmoji] = useState(initiale?.emoji ?? '📁')
  const [deps, setDeps] = useState<string[]>(initiale?.departements ?? [])
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function enregistrer() {
    setEnvoi(true); setErreur(null)
    const r = await fetch(initiale ? `/api/admin/politiques/categories/${initiale.id}` : '/api/admin/politiques/categories', {
      method: initiale ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, nom, emoji, departements: deps }),
    })
    const d = await r.json().catch(() => ({}))
    setEnvoi(false)
    if (!r.ok || !d.categorie) return setErreur(d.error ?? t('Erreur'))
    onEnregistree({ ...d.categorie, departements: d.categorie.departements ?? [] })
  }

  return (
    <div className="space-y-3 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50/40 p-4">
      <p className="text-sm font-bold text-gray-900">{initiale ? t('Modifier la catégorie') : `＋ ${t('Nouvelle catégorie')}`}</p>
      {erreur && <p className="text-sm text-red-700">{erreur}</p>}
      <div className="grid gap-2 sm:grid-cols-[120px_1fr]">
        <div>
          <span className="mb-1 block text-xs font-semibold text-gray-600">{t('Code')}</span>
          <input className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm uppercase" value={code} onChange={e => setCode(normaliserCode(e.target.value))} placeholder="MED" maxLength={8} />
        </div>
        <div>
          <span className="mb-1 block text-xs font-semibold text-gray-600">{t('Nom')}</span>
          <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={nom} onChange={e => setNom(e.target.value)} maxLength={80} placeholder={t('Ex. : Médicaments et substances contrôlées')} />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {EMOJIS_CATEGORIE.map(em => <button key={em} type="button" onClick={() => setEmoji(em)} className={'flex h-9 w-9 items-center justify-center rounded-lg text-lg ' + (emoji === em ? 'bg-white ring-2 ring-indigo-500' : 'bg-white/60 hover:bg-white')}>{em}</button>)}
      </div>
      <div>
        <span className="mb-1 block text-xs font-semibold text-gray-600">{t('Départements associés')}</span>
        <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
          {departements.map(d => {
            const actif = deps.includes(d.id)
            return <button key={d.id} type="button" onClick={() => setDeps(x => actif ? x.filter(y => y !== d.id) : [...x, d.id])} className={'rounded-full border px-3 py-1 text-xs font-medium ' + (actif ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400')}>{actif ? '✓ ' : ''}{d.nom}</button>
          })}
        </div>
        <p className="mt-1 text-xs text-gray-500">{t('Une politique rangée dans cette catégorie sera envoyée automatiquement aux employés de ces départements.')}</p>
      </div>
      <div className="flex items-center justify-end gap-3">
        <button type="button" onClick={onAnnuler} className="text-sm text-gray-500 hover:underline">{t('Annuler')}</button>
        <button type="button" onClick={enregistrer} disabled={envoi || code.length < 2 || !nom.trim()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{envoi ? '…' : initiale ? t('Enregistrer') : t('Créer la catégorie')}</button>
      </div>
    </div>
  )
}

export default function ChoixCategorie({ categories, departements, valeur, onChange }: {
  categories: CategoriePolitique[]
  departements: { id: string; nom: string }[]
  valeur: string | null
  /** cat : la catégorie choisie (null = sans catégorie) */
  onChange: (id: string | null, cat: CategoriePolitique | null) => void
}) {
  const { t } = useT()
  const [cats, setCats] = useState(categories)
  const [creation, setCreation] = useState(false)
  const nomDep = new Map(departements.map(d => [d.id, d.nom]))
  const choisie = cats.find(c => c.id === valeur) ?? null
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{t('Catégorie')}</label>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onChange(null, null)} className={'rounded-lg border-2 px-3 py-2 text-sm ' + (!valeur ? 'border-indigo-500 bg-indigo-50 font-semibold' : 'border-gray-200 text-gray-600 hover:border-gray-300')}>{t('Sans catégorie')}</button>
        {cats.map(c => (
          <button key={c.id} type="button" onClick={() => onChange(c.id, c)} className={'rounded-lg border-2 px-3 py-2 text-left text-sm ' + (valeur === c.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300')}>
            <span className="mr-1">{c.emoji ?? '📁'}</span><b className="font-mono">{c.code}</b> <span className="text-gray-600">{c.nom}</span>
          </button>
        ))}
        {!creation && <button type="button" onClick={() => setCreation(true)} className="rounded-lg border-2 border-dashed border-gray-300 px-3 py-2 text-sm font-semibold text-gray-500 hover:border-indigo-400 hover:text-indigo-700">＋ {t('Nouvelle catégorie')}</button>}
      </div>
      {choisie && choisie.departements.length > 0 && (
        <p className="mt-1.5 text-xs text-indigo-700">🎯 {t('Public ajouté automatiquement : {deps}', { deps: choisie.departements.map(d => nomDep.get(d) ?? '?').join(', ') })}</p>
      )}
      {creation && <div className="mt-2"><FormCategorie departements={departements} onAnnuler={() => setCreation(false)} onEnregistree={c => { setCats(x => [...x, c]); setCreation(false); onChange(c.id, c) }} /></div>}
      <span className="sr-only">{choisie ? libelleCategorie(choisie) : ''}</span>
    </div>
  )
}
