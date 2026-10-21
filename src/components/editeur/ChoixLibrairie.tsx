'use client'
// Fenêtre « Choisir dans la librairie » de l'éditeur de leçons.
import { useT } from '@/lib/i18n/client'
import { useEffect, useMemo, useState } from 'react'
import { LIBELLE_TYPE_LIBRAIRIE, plateformeVideo, type ElementLibrairie, type TypeLibrairie } from '@/lib/librairie-commun'
import { analyserVideoEnLigne, estMediaPrive } from '@/lib/medias'

export type TypeChoix = TypeLibrairie | 'politique'
const ICONE: Record<TypeChoix, string> = { video: '🎬', lien: '🔗', document: '📄', politique: '📜' }
const LIBELLE: Record<TypeChoix, string> = { ...LIBELLE_TYPE_LIBRAIRIE, politique: 'Politiques' }
export type ElementChoisi = Omit<ElementLibrairie, 'type'> & { type: TypeChoix }
/** Bloc de leçon pour un élément choisi : vidéo intégrée (YouTube, Vimeo, fichier) sinon bloc fichier/lien. */
export function blocPourChoix(e: ElementChoisi): { type: 'video' | 'file'; titre: string; url: string; metadata: Record<string, unknown> } {
  const integrable = e.type === 'video' && (estMediaPrive(e.url) || !!analyserVideoEnLigne(e.url))
  const metadata = e.type === 'politique' ? { politique_id: e.id } : { librairie_id: e.id, ...(e.nom_fichier ? { nom_fichier: e.nom_fichier } : {}) }
  return { type: integrable ? 'video' : 'file', titre: e.titre, url: e.url, metadata }
}
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function ChoixLibrairie({ types, onChoisir, onChoisirPlusieurs, onFermer }: {
  types: TypeChoix[]
  onChoisir?: (e: ElementChoisi) => void
  /** Sélection multiple : une case par élément et un bouton « Ajouter ». */
  onChoisirPlusieurs?: (e: ElementChoisi[]) => void
  onFermer: () => void
}) {
  const { t } = useT()
  const multiple = !!onChoisirPlusieurs
  const [selection, setSelection] = useState<ElementChoisi[]>([])
  const basculer = (e: ElementChoisi) => setSelection(s => s.some(x => x.id === e.id) ? s.filter(x => x.id !== e.id) : [...s, e])
  const [type, setType] = useState<TypeChoix>(types[0])
  const [elements, setElements] = useState<ElementChoisi[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    let actif = true
    setElements(null); setErreur(null)
    fetch(type === 'politique' ? '/api/admin/librairie/politiques' : `/api/admin/librairie?type=${type}`).then(async r => {
      const d = await r.json().catch(() => ({}))
      if (!actif) return
      if (!r.ok) { setErreur(d.error ?? 'Chargement impossible'); setElements([]) } else setElements(d.elements)
    })
    return () => { actif = false }
  }, [type])

  useEffect(() => {
    const echap = (e: KeyboardEvent) => { if (e.key === 'Escape') onFermer() }
    window.addEventListener('keydown', echap)
    return () => window.removeEventListener('keydown', echap)
  }, [onFermer])

  const visibles = useMemo(() => (elements ?? []).filter(e => !q || norm(`${e.titre} ${e.categorie ?? ''}`).includes(norm(q))), [elements, q])

  return (
    <div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center p-4" onClick={onFermer}>
      <div role="dialog" aria-modal="true" aria-label={t('Choisir dans la librairie')} onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="p-4 border-b border-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">{t('📚 Choisir dans la librairie')}</h2>
            <button type="button" onClick={onFermer} aria-label={t('Fermer')} className="text-gray-400 text-xl">{t('×')}</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {types.length > 1 && types.map(t => (
              <button key={t} type="button" onClick={() => setType(t)}
                className={'px-3 py-1.5 rounded-lg text-sm font-semibold border ' + (type === t ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-700')}>
                {ICONE[t]} {LIBELLE[t]}
              </button>
            ))}
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={t('Rechercher…')} className="flex-1 min-w-[160px] border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
          </div>
        </div>
        <div className="overflow-y-auto divide-y divide-gray-100">
          {erreur && <p className="p-4 text-sm text-red-600">{erreur}</p>}
          {elements === null && <p className="p-6 text-center text-sm text-gray-400">{t('Chargement…')}</p>}
          {elements && !erreur && visibles.length === 0 && <p className="p-6 text-center text-sm text-gray-400">{t('Aucun élément. Ajoutez-en dans Admin → Librairie.')}</p>}
          {visibles.map(e => (
            <button key={e.id} type="button" onClick={() => multiple ? basculer(e) : onChoisir?.(e)} className="w-full text-left px-4 py-3 hover:bg-indigo-50 flex gap-3">
              {multiple && <input type="checkbox" readOnly tabIndex={-1} checked={selection.some(x => x.id === e.id)} className="mt-1.5" />}
              <span className="text-lg">{ICONE[e.type]}</span>
              <span className="flex-1 min-w-0">
                <span className="block font-medium text-gray-900">{e.titre}</span>
                <span className="block text-xs text-gray-500">{[e.type === 'video' ? plateformeVideo(e.url) : null, e.categorie].filter(Boolean).join(' · ')}</span>
              </span>
            </button>
          ))}
        </div>
        {multiple && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between gap-3">
            <span className="text-sm text-gray-600">{selection.length} élément{selection.length > 1 ? 's' : ''} sélectionné{selection.length > 1 ? 's' : ''}{' '}{t('— une leçon sera créée par élément, dans l’ordre de sélection.')}</span>
            <button type="button" disabled={selection.length === 0} onClick={() => onChoisirPlusieurs?.(selection)}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-50">{t('Ajouter')}</button>
          </div>
        )}
        <p className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">{type === 'politique' ? t('Ajoute un lien vers la politique ; l’employé la lit et la confirme dans son espace Politiques.') : t('L’élément reste lié à la librairie : s’il y est modifié, cette leçon se met à jour.')}</p>
      </div>
    </div>
  )
}
