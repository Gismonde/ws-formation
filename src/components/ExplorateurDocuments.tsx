'use client'
// Nos guides / Nos consentements : arbre des catégories à gauche, recherche et filtre de langue, cartes à droite.
import { useMemo, useState } from 'react'
import { useT } from '@/lib/i18n/client'
import { cheminTheme, descendants, filtrerDocuments, langueDe, themesDe, type FiltreDocs, type Theme } from '@/lib/communications'

export type DocExplorateur = { id: string; titre: string; description: string; themes: string[]; theme_id: string | null; date: string; pdf: boolean; vignette: boolean }

export default function ExplorateurDocuments({ docs, themes, telechargeable }: { docs: DocExplorateur[]; themes: Theme[]; telechargeable: boolean }) {
  const { t } = useT()
  const [f, setF] = useState<FiltreDocs>({ theme: null, q: '', langue: '' })
  const [ouverts, setOuverts] = useState<Set<string>>(() => new Set(themes.filter(x => !x.parent_id).map(x => x.id)))
  const [arbreMobile, setArbreMobile] = useState(false)

  // Comptes par catégorie (avec la recherche et la langue, sans le filtre de catégorie)
  const sansCat = useMemo(() => filtrerDocuments(docs, themes, { ...f, theme: null }), [docs, themes, f])
  const compte = (id: string) => { const d = descendants(id, themes); return sansCat.filter(c => themesDe(c).some(x => d.has(x))).length }
  const nbSans = useMemo(() => filtrerDocuments(sansCat, themes, { theme: 'sans', q: '', langue: '' }).length, [sansCat, themes])
  const visibles = useMemo(() => filtrerDocuments(docs, themes, f).sort((a, b) => a.titre.localeCompare(b.titre, 'fr')), [docs, themes, f])
  const enfants = (p: string | null) => themes.filter(x => x.parent_id === p).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  const choisi = f.theme && f.theme !== 'sans' ? cheminTheme(f.theme, themes) : []

  const noeud = (th: Theme, niveau: number): React.ReactNode => {
    const n = compte(th.id)
    if (n === 0) return null
    const sous = enfants(th.id)
    const ouvert = ouverts.has(th.id)
    const actif = f.theme === th.id
    return (
      <li key={th.id}>
        <div className={'flex items-center gap-1 rounded-lg pr-2 ' + (actif ? 'bg-indigo-100 text-indigo-900' : 'hover:bg-gray-100 text-gray-800')} style={{ paddingLeft: 4 + niveau * 14 }}>
          {sous.some(s => compte(s.id) > 0)
            ? <button type="button" aria-label={ouvert ? t('Replier') : t('Déplier')} onClick={() => setOuverts(o => { const n2 = new Set(o); if (n2.has(th.id)) n2.delete(th.id); else n2.add(th.id); return n2 })} className="w-5 text-gray-500 text-xs">{ouvert ? '▾' : '▸'}</button>
            : <span className="w-5" />}
          <button type="button" onClick={() => { setF({ ...f, theme: actif ? null : th.id }); setArbreMobile(false) }} className={'flex-1 text-left py-1.5 text-sm ' + (niveau === 0 ? 'font-semibold' : '')}>{th.nom}</button>
          <span className="text-xs text-gray-400">{n}</span>
        </div>
        {ouvert && sous.length > 0 && <ul>{sous.map(s => noeud(s, niveau + 1))}</ul>}
      </li>
    )
  }

  const arbre = (
    <nav aria-label={t('Catégories')} className="text-sm">
      <button type="button" onClick={() => setF({ ...f, theme: null })} className={'w-full flex justify-between rounded-lg px-2 py-1.5 font-semibold ' + (f.theme === null ? 'bg-indigo-100 text-indigo-900' : 'hover:bg-gray-100 text-gray-800')}>
        <span>{t('Tous les documents')}</span><span className="text-xs text-gray-400 font-normal">{sansCat.length}</span>
      </button>
      <ul className="mt-1">{enfants(null).map(th => noeud(th, 0))}</ul>
      {nbSans > 0 && (
        <button type="button" onClick={() => setF({ ...f, theme: 'sans' })} className={'w-full flex justify-between rounded-lg px-2 py-1.5 mt-1 ' + (f.theme === 'sans' ? 'bg-indigo-100 text-indigo-900' : 'hover:bg-gray-100 text-gray-700')}>
          <span>{t('Autres')}</span><span className="text-xs text-gray-400">{nbSans}</span>
        </button>
      )}
    </nav>
  )

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr] items-start">
      <aside className="hidden lg:block bg-white border border-gray-200 rounded-xl p-3 sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto">{arbre}</aside>
      <div className="min-w-0">
        <div className="flex flex-wrap gap-2 mb-4">
          <input type="search" value={f.q} onChange={e => setF({ ...f, q: e.target.value })} placeholder={t('Rechercher (titre, chirurgien, intervention…)')}
            className="flex-1 min-w-[220px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <select value={f.langue} onChange={e => setF({ ...f, langue: e.target.value as FiltreDocs['langue'] })} aria-label={t('Langue')}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="">{t('Toutes les langues')}</option>
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
          <button type="button" onClick={() => setArbreMobile(v => !v)} className="lg:hidden rounded-lg border border-gray-300 px-3 py-2 text-sm">🗂 {t('Catégories')}</button>
          {(f.theme || f.q || f.langue) && <button type="button" onClick={() => setF({ theme: null, q: '', langue: '' })} className="text-sm text-indigo-700 hover:underline px-2">{t('Effacer les filtres')}</button>}
        </div>
        {arbreMobile && <div className="lg:hidden bg-white border border-gray-200 rounded-xl p-3 mb-4">{arbre}</div>}
        <p className="text-sm text-gray-500 mb-3">
          {choisi.length > 0 && <span className="font-medium text-gray-700">{choisi.map(x => x.nom).join(' › ')} · </span>}
          {f.theme === 'sans' && <span className="font-medium text-gray-700">{t('Autres')} · </span>}
          {t('{n} document(s)', { n: visibles.length })}
        </p>
        {visibles.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-400">{t('Aucun document ne correspond à votre recherche.')}</div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
            {visibles.map(c => (
              <div key={c.id} className="group bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md hover:border-gray-300 transition flex flex-col">
                <a href={`/api/communications/${c.id}/ouvrir`} target="_blank" rel="noopener" className="flex-1">
                  <div className="aspect-[3/4] bg-gray-50 flex items-center justify-center overflow-hidden border-b border-gray-100">
                    {c.vignette
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={`/api/communications/${c.id}/ouvrir?apercu=1`} alt={c.titre} loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.02] transition" />
                      : <span className="text-5xl">📄</span>}
                  </div>
                  <div className="p-3">
                    <p className="font-semibold text-gray-900 text-sm leading-snug">{c.titre}</p>
                    {themesDe(c).slice(0, 2).map(id => <p key={id} className="text-[11px] text-indigo-700 mt-1 truncate">{cheminTheme(id, themes).map(x => x.nom).join(' › ')}</p>)}
                    <p className="text-xs text-gray-400 mt-1">{c.description || c.date}{c.pdf ? ' · PDF' : ''} · {langueDe(c) === 'en' ? 'EN' : 'FR'}</p>
                  </div>
                </a>
                {telechargeable && <a href={`/api/communications/${c.id}/ouvrir?telecharger=1`} className="mx-3 mb-3 text-center text-sm font-semibold px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">⬇ {t('Télécharger')}</a>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
