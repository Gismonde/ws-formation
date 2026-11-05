import { i18n } from '@/lib/i18n/serveur'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActeur, serviceClient } from '@/lib/permissions'
import {
  employesDansPortee, peutPublierPolitiques, peutSuivrePolitique, Politique, statistiquesPolitiques, categoriesPolitiques,
} from '@/lib/politiques'
import { parCategorie } from '@/lib/politiques-categories'
import { publicDe } from '@/lib/politiques-affichage'

function Barre({ pct }: { pct: number }) {
  const couleur = pct === 100 ? '#16a34a' : pct >= 70 ? '#2563eb' : pct >= 40 ? '#f59e0b' : '#dc2626'
  return (
    <div className="flex items-center gap-2 min-w-[150px]">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div style={{ width: `${pct}%`, background: couleur }} className="h-full rounded-full" />
      </div>
      <span className="text-sm font-semibold w-10 text-right" style={{ color: couleur }}>{pct}%</span>
    </div>
  )
}

export default async function PolitiquesAdminPage({ searchParams }: { searchParams: Promise<{ archives?: string; cat?: string }> }) {
  const { t, loc } = await i18n()
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  const { archives, cat } = await searchParams
  const voirArchives = archives === '1'

  const sb = serviceClient()
  const [{ data, error }, { data: deps }] = await Promise.all([
    sb.from('politiques').select('*').eq('actif', !voirArchives).order('publiee_le', { ascending: false }),
    sb.from('departements').select('id, nom'),
  ])
  const noms = new Map((deps ?? []).map(d => [d.id as string, d.nom as string]))
  const toutes = ((data ?? []) as Politique[]).filter(p => peutSuivrePolitique(acteur, p))
  const categories = await categoriesPolitiques(sb)
  const politiques = !cat ? toutes : cat === 'aucune' ? toutes.filter(p => !p.categorie_id) : toutes.filter(p => p.categorie_id === cat)
  const groupes = parCategorie(politiques, categories)
  const lienCat = (c?: string) => '/admin/politiques?' + new URLSearchParams({ ...(voirArchives ? { archives: '1' } : {}), ...(c ? { cat: c } : {}) }).toString()
  const stats = await statistiquesPolitiques(sb, politiques, await employesDansPortee(sb, acteur))
  const peutPublier = peutPublierPolitiques(acteur)

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Politiques')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Taux de « lu et compris » de la version en vigueur{acteur.role === 'gestionnaire' ? t(', pour les employés de votre département') : t(', dans votre périmètre')}.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={voirArchives ? '/admin/politiques' : '/admin/politiques?archives=1'} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white hover:bg-gray-50">
            {voirArchives ? 'Politiques en vigueur' : 'Archives'}
          </Link>
          {peutPublier && (
            <Link href="/admin/politiques/categories" className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white hover:bg-gray-50">🗂️ {t('Catégories')}</Link>
          )}
          {peutPublier && (
            <Link href="/admin/politiques/nouvelle" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium">{t('+ Nouvelle politique')}</Link>
          )}
        </div>
      </div>

      {categories.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {[{ id: undefined as string | undefined, l: t('Toutes'), n: toutes.length },
            ...categories.map(c => ({ id: c.id as string | undefined, l: `${c.emoji ?? '📁'} ${c.code}`, n: toutes.filter(p => p.categorie_id === c.id).length, titre: c.nom })),
            { id: 'aucune', l: t('Sans catégorie'), n: toutes.filter(p => !p.categorie_id).length }]
            .filter(c => c.id === undefined || c.n > 0 || cat === c.id)
            .map(c => (
              <Link key={c.id ?? 'toutes'} href={lienCat(c.id)} title={'titre' in c ? String(c.titre) : undefined}
                className={'rounded-full border px-3.5 py-1.5 text-xs font-bold ' + (cat === c.id ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300')}>
                {c.l} <span className="opacity-60">{c.n}</span>
              </Link>
            ))}
        </div>
      )}
      {error ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-800">
          Le module Politiques n’est pas encore activé dans la base de données (script SQL <code>{t('politiques.sql')}</code> à exécuter dans Supabase).
        </div>
      ) : politiques.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <p className="text-gray-500 text-sm">{voirArchives ? t('Aucune politique archivée.') : t('Aucune politique publiée pour le moment.')}</p>
          {peutPublier && !voirArchives && <Link href="/admin/politiques/nouvelle" className="inline-block mt-3 text-indigo-600 text-sm hover:underline">{t('Publier la première politique →')}</Link>}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase text-gray-500">
                <th className="text-left px-5 py-3 font-semibold">{t('Politique')}</th>
                <th className="text-left px-3 py-3 font-semibold">{t('S’adresse à')}</th>
                <th className="text-left px-3 py-3 font-semibold">{t('Lu et compris')}</th>
                <th className="text-center px-3 py-3 font-semibold">{t('En attente')}</th>
              </tr>
            </thead>
            <tbody>
              {groupes.map(g => [
                (categories.length > 0 && (
                  <tr key={'g-' + (g.categorie?.id ?? 'aucune')} className="border-t border-gray-200 bg-indigo-50/50">
                    <td colSpan={4} className="px-5 py-2 text-xs font-bold uppercase tracking-wide text-indigo-900">
                      {g.categorie ? <>{g.categorie.emoji ?? '📁'} <span className="font-mono">{g.categorie.code}</span> — {g.categorie.nom}</> : t('Sans catégorie')}
                      <span className="ml-2 font-normal normal-case text-indigo-700/70">{t('{n} politique(s)', { n: g.politiques.length })}</span>
                    </td>
                  </tr>
                )),
                ...g.politiques.map(p => {
                const s = stats[p.id]
                return (
                  <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <Link href={`/admin/politiques/${p.id}`} className="font-semibold text-gray-900 hover:text-indigo-700">{p.titre}</Link>
                      <div className="text-xs text-gray-400">{t('Version')}{' '}{p.version} · {new Date(p.publiee_le).toLocaleDateString(loc, { dateStyle: 'medium' })}</div>
                    </td>
                    <td className="px-3 py-3 text-gray-600">{publicDe(p, noms, t)}</td>
                    <td className="px-3 py-3">
                      {s.total === 0 ? <span className="text-xs text-gray-500">{t('Aucun employé visé')}</span> : (<>
                        <Barre pct={s.pourcentage} />
                        <div className="text-xs text-gray-400 mt-0.5">{t('{c} / {n} employé(s)', { c: s.confirmes, n: s.total })}</div>
                      </>)}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <Link href={`/admin/politiques/${p.id}?filtre=attente`} className={'font-semibold ' + (s.total - s.confirmes > 0 ? 'text-amber-700 hover:underline' : 'text-gray-300')}>
                        {s.total - s.confirmes}
                      </Link>
                    </td>
                  </tr>
                )
              })])}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
