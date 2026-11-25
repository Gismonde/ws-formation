'use client'
// Arbre des catégories (Chirurgie › type › chirurgien) avec le nombre de documents ; partagé employés / administration.
import { useState } from 'react'
import { useT } from '@/lib/i18n/client'
import { descendants, themesDe, type Theme } from '@/lib/communications'

type Doc = { themes?: string[] | null; theme_id?: string | null }

export default function ArbreThemes({ docs, themes, choisi, onChoisir }: { docs: Doc[]; themes: Theme[]; choisi: string | null; onChoisir: (id: string | null) => void }) {
  const { t } = useT()
  const [ouverts, setOuverts] = useState<Set<string>>(() => new Set(themes.filter(x => !x.parent_id).map(x => x.id)))
  const connus = new Set(themes.map(x => x.id))
  const compte = (id: string) => { const d = descendants(id, themes); return docs.filter(c => themesDe(c).some(x => d.has(x))).length }
  const nbSans = docs.filter(c => !themesDe(c).some(id => connus.has(id))).length
  const enfants = (p: string | null) => themes.filter(x => x.parent_id === p).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))

  const noeud = (th: Theme, niveau: number): React.ReactNode => {
    const n = compte(th.id)
    if (n === 0) return null
    const sous = enfants(th.id)
    const ouvert = ouverts.has(th.id)
    const actif = choisi === th.id
    return (
      <li key={th.id}>
        <div className={'flex items-center gap-1 rounded-lg pr-2 ' + (actif ? 'bg-indigo-100 text-indigo-900' : 'hover:bg-gray-100 text-gray-800')} style={{ paddingLeft: 4 + niveau * 14 }}>
          {sous.some(s => compte(s.id) > 0)
            ? <button type="button" aria-label={ouvert ? t('Replier') : t('Déplier')} onClick={() => setOuverts(o => { const n2 = new Set(o); if (n2.has(th.id)) n2.delete(th.id); else n2.add(th.id); return n2 })} className="w-5 text-gray-500 text-xs">{ouvert ? '▾' : '▸'}</button>
            : <span className="w-5" />}
          <button type="button" onClick={() => onChoisir(actif ? null : th.id)} className={'flex-1 text-left py-1.5 text-sm ' + (niveau === 0 ? 'font-semibold' : '')}>{th.nom}</button>
          <span className="text-xs text-gray-400">{n}</span>
        </div>
        {ouvert && sous.length > 0 && <ul>{sous.map(s => noeud(s, niveau + 1))}</ul>}
      </li>
    )
  }

  return (
    <nav aria-label={t('Catégories')} className="text-sm">
      <button type="button" onClick={() => onChoisir(null)} className={'w-full flex justify-between rounded-lg px-2 py-1.5 font-semibold ' + (choisi === null ? 'bg-indigo-100 text-indigo-900' : 'hover:bg-gray-100 text-gray-800')}>
        <span>{t('Tous les documents')}</span><span className="text-xs text-gray-400 font-normal">{docs.length}</span>
      </button>
      <ul className="mt-1">{enfants(null).map(th => noeud(th, 0))}</ul>
      {nbSans > 0 && (
        <button type="button" onClick={() => onChoisir('sans')} className={'w-full flex justify-between rounded-lg px-2 py-1.5 mt-1 ' + (choisi === 'sans' ? 'bg-indigo-100 text-indigo-900' : 'hover:bg-gray-100 text-gray-700')}>
          <span>{t('Autres')}</span><span className="text-xs text-gray-400">{nbSans}</span>
        </button>
      )}
    </nav>
  )
}
