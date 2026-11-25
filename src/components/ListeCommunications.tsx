import { redirect } from 'next/navigation'
import { i18n } from '@/lib/i18n/serveur'
import { getActeur, serviceClient } from '@/lib/permissions'
import { getEspace } from '@/lib/espace'
import { estExterne } from '@/lib/membres-externes'
import { FUSEAU } from '@/lib/fuseau'
import Link from 'next/link'
import { CATEGORIES, PUBLICS, avecThemes, grouperParTheme, type Categorie, type Communication, type Public, type Theme } from '@/lib/communications'

// Politiques & procédures → Affiches & communications, Nos guides, Nos consentements (par clinique).
export default async function ListeCommunications({ categorie, pour = 'employes' }: { categorie: Categorie; pour?: Public }) {
  const { t, loc } = await i18n()
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (estExterne(acteur)) redirect('/dashboard') // réservé aux employés de la clinique
  const espace = await getEspace(acteur)
  const sb = serviceClient()
  let requete = sb.from('communications').select('*').eq('publie', true).eq('categorie', categorie)
  if (categorie === 'guide') requete = requete.eq('public', pour)
  const { data } = await requete.in('clinique', espace.cliniquesContenu).order('publie_le', { ascending: false })
  const liste = (data ?? []) as Communication[]
  const { data: themes } = avecThemes(categorie) ? await sb.from('themes_documents').select('id, nom') : { data: [] }
  const groupes = avecThemes(categorie) ? grouperParTheme(liste, (themes ?? []) as Theme[]) : [{ theme: null, elements: liste }]
  const date = (d: string | null) => d ? new Date(d).toLocaleDateString(loc, { timeZone: FUSEAU, dateStyle: 'long' }) : ''

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">{CATEGORIES[categorie].emoji} {t(CATEGORIES[categorie].libelle)}</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">{t(CATEGORIES[categorie].intro)}</p>
      {categorie === 'guide' && (
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {(Object.keys(PUBLICS) as Public[]).map(p => (
            <Link key={p} href={p === 'employes' ? '/dashboard/guides' : '/dashboard/guides?pour=patients'}
              className={'px-4 py-2 text-sm font-semibold -mb-px border-b-2 ' + (p === pour ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-800')}>
              {p === 'employes' ? '👩‍⚕️' : '🧑‍🤝‍🧑'} {t(PUBLICS[p])}
            </Link>
          ))}
        </div>
      )}
      {liste.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-400">{t(CATEGORIES[categorie].vide)}</div>
      ) : (
        <div className="space-y-8">
        {groupes.map(g => (
        <section key={g.theme?.id ?? 'sans'}>
          {avecThemes(categorie) && <h2 className="text-lg font-semibold text-gray-800 mb-3">{g.theme ? g.theme.nom : t('Autres')} <span className="text-sm font-normal text-gray-400">({g.elements.length})</span></h2>}
        <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
          {g.elements.map(c => {
            const image = c.type_fichier.startsWith('image/') || !!c.apercu
            return (
              <div key={c.id} className="group bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md hover:border-gray-300 transition flex flex-col">
              <a href={`/api/communications/${c.id}/ouvrir`} target="_blank" rel="noopener" className="flex-1">
                <div className="aspect-[3/4] bg-gray-50 flex items-center justify-center overflow-hidden border-b border-gray-100">
                  {image
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={`/api/communications/${c.id}/ouvrir?apercu=1`} alt={c.titre} loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.02] transition" />
                    : <span className="text-5xl">📄</span>}
                </div>
                <div className="p-4">
                  <p className="font-semibold text-gray-900 leading-snug">{c.titre}</p>
                  {c.description && <p className="text-sm text-gray-600 mt-1 line-clamp-3">{c.description}</p>}
                  <p className="text-xs text-gray-400 mt-2">{date(c.publie_le)}{c.type_fichier === 'application/pdf' ? ' · PDF' : ''}</p>
                </div>
              </a>
              {CATEGORIES[categorie].telechargeable && (
                <a href={`/api/communications/${c.id}/ouvrir?telecharger=1`} className="mx-4 mb-4 text-center text-sm font-semibold px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">⬇ {t('Télécharger')}</a>
              )}
              </div>
            )
          })}
        </div>
        </section>
        ))}
        </div>
      )}
    </div>
  )
}
