import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActeur, serviceClient } from '@/lib/permissions'
import {
  employesDansPortee, peutPublierPolitiques, peutSuivrePolitique, Politique, statistiquesPolitiques,
} from '@/lib/politiques'
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

export default async function PolitiquesAdminPage({ searchParams }: { searchParams: Promise<{ archives?: string }> }) {
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  const { archives } = await searchParams
  const voirArchives = archives === '1'

  const sb = serviceClient()
  const [{ data, error }, { data: deps }] = await Promise.all([
    sb.from('politiques').select('*').eq('actif', !voirArchives).order('publiee_le', { ascending: false }),
    sb.from('departements').select('id, nom'),
  ])
  const noms = new Map((deps ?? []).map(d => [d.id as string, d.nom as string]))
  const politiques = ((data ?? []) as Politique[]).filter(p => peutSuivrePolitique(acteur, p))
  const stats = await statistiquesPolitiques(sb, politiques, await employesDansPortee(sb, acteur))
  const peutPublier = peutPublierPolitiques(acteur)

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Politiques</h1>
          <p className="text-sm text-gray-500 mt-1">
            Taux de « lu et compris » de la version en vigueur{acteur.role === 'gestionnaire' ? ', pour les employés de votre département' : ', dans votre périmètre'}.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={voirArchives ? '/admin/politiques' : '/admin/politiques?archives=1'} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white hover:bg-gray-50">
            {voirArchives ? 'Politiques en vigueur' : 'Archives'}
          </Link>
          {peutPublier && (
            <Link href="/admin/politiques/nouvelle" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">+ Nouvelle politique</Link>
          )}
        </div>
      </div>

      {error ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-800">
          Le module Politiques n’est pas encore activé dans la base de données (script SQL <code>politiques.sql</code> à exécuter dans Supabase).
        </div>
      ) : politiques.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <p className="text-gray-500 text-sm">{voirArchives ? 'Aucune politique archivée.' : 'Aucune politique publiée pour le moment.'}</p>
          {peutPublier && !voirArchives && <Link href="/admin/politiques/nouvelle" className="inline-block mt-3 text-blue-600 text-sm hover:underline">Publier la première politique →</Link>}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase text-gray-500">
                <th className="text-left px-5 py-3 font-semibold">Politique</th>
                <th className="text-left px-3 py-3 font-semibold">S’adresse à</th>
                <th className="text-left px-3 py-3 font-semibold">Lu et compris</th>
                <th className="text-center px-3 py-3 font-semibold">En attente</th>
              </tr>
            </thead>
            <tbody>
              {politiques.map(p => {
                const s = stats[p.id]
                return (
                  <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <Link href={`/admin/politiques/${p.id}`} className="font-semibold text-gray-900 hover:text-blue-700">{p.titre}</Link>
                      <div className="text-xs text-gray-400">Version {p.version} · {new Date(p.publiee_le).toLocaleDateString('fr-CA', { dateStyle: 'medium' })}</div>
                    </td>
                    <td className="px-3 py-3 text-gray-600">{publicDe(p, noms)}</td>
                    <td className="px-3 py-3">
                      <Barre pct={s.pourcentage} />
                      <div className="text-xs text-gray-400 mt-0.5">{s.confirmes} / {s.total} employés</div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <Link href={`/admin/politiques/${p.id}?filtre=attente`} className={'font-semibold ' + (s.total - s.confirmes > 0 ? 'text-amber-700 hover:underline' : 'text-gray-300')}>
                        {s.total - s.confirmes}
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
