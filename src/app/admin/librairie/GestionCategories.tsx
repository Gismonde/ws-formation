'use client'
// Gestion des catégories de la librairie : arbre à deux niveaux, ajout, renommage, déplacement, suppression.
import { useMemo, useState } from 'react'
import { useT } from '@/lib/i18n/client'
import { useConfirmer } from '@/components/Confirmation'
import { arbreCategories, type CategorieLibrairie } from '@/lib/librairie-categories'

export default function GestionCategories({ categories, compteurs, peutGerer, onChange }: {
  categories: CategorieLibrairie[]
  /** Nombre d'éléments par nom de catégorie (onglet affiché) */
  compteurs: Record<string, number>
  peutGerer: boolean
  onChange: () => void
}) {
  const { t } = useT()
  const confirmer = useConfirmer()
  const [q, setQ] = useState('')
  const [fermees, setFermees] = useState<Set<string>>(new Set())
  const [nouveau, setNouveau] = useState<{ nom: string; parent: string } | null>(null)
  const [edition, setEdition] = useState<{ id: string; nom: string; parent: string } | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  const arbre = useMemo(() => arbreCategories(categories), [categories])
  const racines = arbre.filter(c => c.niveau === 0)
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const visibles = arbre.filter(c => {
    if (q) return norm(c.nom).includes(norm(q)) || (c.niveau === 0 && arbre.some(x => x.parent_id === c.id && norm(x.nom).includes(norm(q))))
    return c.niveau === 0 || !fermees.has(c.parent_id!)
  })

  async function appel(methode: string, corps?: unknown, url = '/api/admin/librairie/categories') {
    setEnvoi(true); setErreur(null)
    try {
      const r = await fetch(url, { method: methode, headers: { 'Content-Type': 'application/json' }, body: corps ? JSON.stringify(corps) : undefined })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setErreur(d.error ?? t('Action impossible')); return false }
      onChange(); return true
    } catch { setErreur(t('Action impossible')); return false } finally { setEnvoi(false) }
  }

  const champ = 'border border-gray-300 rounded-lg px-3 py-2 text-sm'
  const icone = 'px-2 py-1 rounded-md text-sm hover:bg-gray-100 disabled:opacity-30'

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-gray-900 mr-auto">🗂 {t('Gestion des catégories')}</h2>
        <button type="button" onClick={() => setFermees(fermees.size ? new Set() : new Set(racines.filter(r => r.enfants).map(r => r.id)))} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-600">
          {fermees.size ? t('Tout ouvrir') : t('Tout fermer')}
        </button>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('Rechercher…')} className={champ + ' w-48'} />
        {peutGerer && <button type="button" onClick={() => { setNouveau({ nom: '', parent: '' }); setEdition(null) }} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold">+ {t('Ajouter une catégorie')}</button>}
      </div>
      {peutGerer && <p className="text-xs text-gray-500">{t('Deux niveaux : catégorie principale et sous-catégories. Utilisez ↑ ↓ pour changer l’ordre. Renommer une catégorie met à jour tous les éléments qui l’utilisent.')}</p>}
      {erreur && <p className="text-sm text-red-600">{erreur}</p>}

      {nouveau && (
        <div className="flex flex-wrap gap-2 items-center bg-indigo-50 border border-indigo-200 rounded-lg p-3">
          <input autoFocus value={nouveau.nom} onChange={e => setNouveau({ ...nouveau, nom: e.target.value })} placeholder={t('Nom de la catégorie')} maxLength={80} className={champ + ' flex-1 min-w-[200px]'} />
          <select value={nouveau.parent} onChange={e => setNouveau({ ...nouveau, parent: e.target.value })} className={champ}>
            <option value="">{t('— Catégorie principale —')}</option>
            {racines.map(r => <option key={r.id} value={r.id}>{t('Sous-catégorie de : {nom}', { nom: r.nom })}</option>)}
          </select>
          <button type="button" disabled={envoi || !nouveau.nom.trim()} onClick={async () => { if (await appel('POST', { nom: nouveau.nom, parent_id: nouveau.parent || null })) setNouveau(null) }} className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-40">{t('Ajouter')}</button>
          <button type="button" onClick={() => setNouveau(null)} className="px-3 py-2 text-sm text-gray-500">{t('Annuler')}</button>
        </div>
      )}

      <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
        <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2 text-xs font-semibold text-gray-500 uppercase bg-gray-50">
          <span>{t('Catégorie')}</span><span>{t('Éléments')}</span><span>{peutGerer ? t('Actions') : ''}</span>
        </div>
        {visibles.length === 0 && <p className="px-3 py-6 text-sm text-gray-500 text-center">{t('Aucune catégorie.')}</p>}
        {visibles.map(c => {
          const enEdition = edition?.id === c.id
          const total = (compteurs[c.nom] ?? 0) + (c.niveau === 0 ? arbre.filter(x => x.parent_id === c.id).reduce((s, x) => s + (compteurs[x.nom] ?? 0), 0) : 0)
          return (
            <div key={c.id} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center px-3 py-2">
              <div className={'flex items-center gap-2 ' + (c.niveau ? 'pl-7' : '')}>
                {c.niveau === 0 && c.enfants > 0 ? (
                  <button type="button" onClick={() => { const f = new Set(fermees); if (f.has(c.id)) f.delete(c.id); else f.add(c.id); setFermees(f) }} className="text-gray-400 w-4" aria-label={t('Ouvrir ou fermer')}>{fermees.has(c.id) ? '▸' : '▾'}</button>
                ) : <span className="w-4" />}
                {enEdition ? (
                  <div className="flex flex-wrap gap-2 flex-1">
                    <input autoFocus value={edition.nom} onChange={e => setEdition({ ...edition, nom: e.target.value })} maxLength={80} className={champ + ' flex-1 min-w-[180px] !py-1'} />
                    {c.enfants === 0 && (
                      <select value={edition.parent} onChange={e => setEdition({ ...edition, parent: e.target.value })} className={champ + ' !py-1'}>
                        <option value="">{t('— Catégorie principale —')}</option>
                        {racines.filter(r => r.id !== c.id).map(r => <option key={r.id} value={r.id}>{t('Sous-catégorie de : {nom}', { nom: r.nom })}</option>)}
                      </select>
                    )}
                    <button type="button" disabled={envoi} onClick={async () => { if (await appel('PATCH', { id: c.id, nom: edition.nom, parent_id: edition.parent || null })) setEdition(null) }} className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-sm">{t('Enregistrer')}</button>
                    <button type="button" onClick={() => setEdition(null)} className="px-2 py-1 text-sm text-gray-500">{t('Annuler')}</button>
                  </div>
                ) : (
                  <span className={c.niveau === 0 ? 'font-semibold text-gray-900 text-sm' : 'text-sm text-gray-700'}>{c.nom}</span>
                )}
              </div>
              <span className="text-xs text-gray-500 text-right w-14">{total || ''}</span>
              <div className="flex items-center gap-0.5">
                {peutGerer && !enEdition && <>
                  <button type="button" className={icone} disabled={envoi} onClick={() => appel('PATCH', { id: c.id, sens: -1 })} aria-label={t('Monter')} title={t('Monter')}>↑</button>
                  <button type="button" className={icone} disabled={envoi} onClick={() => appel('PATCH', { id: c.id, sens: 1 })} aria-label={t('Descendre')} title={t('Descendre')}>↓</button>
                  <button type="button" className={icone} onClick={() => { setEdition({ id: c.id, nom: c.nom, parent: c.parent_id ?? '' }); setNouveau(null) }} aria-label={t('Modifier')} title={t('Modifier')}>✏️</button>
                  <button type="button" className={icone} disabled={envoi} title={t('Supprimer')} aria-label={t('Supprimer')} onClick={async () => {
                    const msg = t('Supprimer la catégorie « {nom} » ?', { nom: c.nom }) + (total ? ' ' + t('Ses éléments resteront dans la librairie, sans catégorie.') : '') + (c.enfants ? ' ' + t('Ses sous-catégories deviendront des catégories principales.') : '')
                    if (await confirmer({ message: msg, bouton: t('Supprimer'), danger: true })) appel('DELETE', undefined, `/api/admin/librairie/categories?id=${c.id}`)
                  }}>🗑</button>
                </>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
