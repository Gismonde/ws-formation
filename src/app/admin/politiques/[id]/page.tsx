import { i18n } from '@/lib/i18n/serveur'
import { redirect, notFound } from 'next/navigation'
import { getActeur, serviceClient } from '@/lib/permissions'
import {
  cliniquesPolitiquePossibles, employesDansPortee, peutGererPolitique, peutSuivrePolitique, Politique, statistiquesPolitiques,
} from '@/lib/politiques'
import { publicDe } from '@/lib/politiques-affichage'
import { signerUrlsMedias } from '@/lib/medias-serveur'
import { courrielsActifs } from '@/lib/courriels'
import { CLINIQUE_EMPLOYE_LABEL, CliniqueEmploye } from '@/lib/cliniques'
import ActionsPolitique from './ActionsPolitique'
import ListeConfirmations, { LigneConfirmation } from './ListeConfirmations'

export default async function PolitiqueAdminPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ filtre?: string }>
}) {
  const { t, loc } = await i18n()
  const { id } = await params
  const { filtre } = await searchParams
  const acteur = await getActeur()
  if (!acteur) redirect('/login')

  const sb = serviceClient()
  const { data } = await sb.from('politiques').select('*').eq('id', id).single()
  const pol = data as Politique | null
  if (!pol || !peutSuivrePolitique(acteur, pol)) notFound()

  const [{ data: deps }, { data: versions }, employes] = await Promise.all([
    sb.from('departements').select('id, nom').order('nom'),
    sb.from('politiques_versions').select('version, nom_fichier, note_version, publiee_le, fichier').eq('politique_id', id).order('version', { ascending: false }),
    employesDansPortee(sb, acteur),
  ])
  const noms = new Map((deps ?? []).map(d => [d.id as string, d.nom as string]))
  const stat = (await statistiquesPolitiques(sb, [pol], employes))[pol.id]
  const urls = await signerUrlsMedias([pol.fichier, ...(versions ?? []).map(v => v.fichier)])

  const lignes: LigneConfirmation[] = stat.vises.map(e => ({
    id: e.id,
    nom: `${e.prenom ?? ''} ${e.nom ?? ''}`.trim() || (e.email ?? ''),
    email: e.email ?? '',
    departement: (e.departement_id && noms.get(e.departement_id)) || '—',
    clinique: CLINIQUE_EMPLOYE_LABEL[e.clinique as CliniqueEmploye] ?? '—',
    confirme_le: stat.confirmations[e.id]?.confirme_le ?? null,
  }))

  // Taux par département
  const parDep = new Map<string, { total: number; ok: number }>()
  for (const l of lignes) {
    const x = parDep.get(l.departement) ?? { total: 0, ok: 0 }
    x.total++; if (l.confirme_le) x.ok++
    parDep.set(l.departement, x)
  }

  const couleur = stat.pourcentage === 100 ? '#16a34a' : stat.pourcentage >= 70 ? '#2563eb' : stat.pourcentage >= 40 ? '#f59e0b' : '#dc2626'

  return (
    <div className="max-w-5xl">
      <a href="/admin/politiques" className="text-sm text-blue-600 hover:underline">{t('← Politiques')}</a>
      <div className="flex flex-wrap items-start gap-4 mt-2 mb-4">
        <div className="flex-1 min-w-[260px]">
          <h1 className="text-2xl font-bold text-gray-900">
            {pol.titre} {!pol.actif && <span className="text-xs align-middle bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full ml-2">{t('Archivée')}</span>}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Version {pol.version}{' '}{t('· publiée le')}{' '}{new Date(pol.publiee_le).toLocaleDateString(loc, { dateStyle: 'long' })} · {publicDe(pol, noms)}
          </p>
          {pol.description && <p className="text-sm text-gray-700 mt-2">{pol.description}</p>}
          {urls[pol.fichier] && (
            <a href={urls[pol.fichier]} target="_blank" rel="noopener noreferrer" className="inline-block mt-3 text-sm text-blue-700 hover:underline">
              📄 Ouvrir le document{pol.nom_fichier ? ` (${pol.nom_fichier})` : ''}
            </a>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 text-center min-w-[200px]">
          <div className="text-4xl font-bold" style={{ color: couleur }}>{stat.pourcentage}%</div>
          <div className="text-xs uppercase tracking-wide text-gray-500 mt-1">{t('Lu et compris')}</div>
          <div className="text-sm text-gray-700 mt-2">{stat.confirmes} / {stat.total} employés</div>
          <div className="h-2 bg-gray-100 rounded-full mt-3 overflow-hidden"><div className="h-full" style={{ width: `${stat.pourcentage}%`, background: couleur }} /></div>
        </div>
      </div>

      <ActionsPolitique
        id={pol.id} titre={pol.titre} description={pol.description} clinique={pol.clinique}
        departementsChoisis={pol.departements ?? []} actif={pol.actif}
        enAttente={stat.total - stat.confirmes}
        peutGerer={peutGererPolitique(acteur, pol)}
        courrielsActifs={courrielsActifs()}
        cliniques={cliniquesPolitiquePossibles(acteur)}
        departements={deps ?? []}
      />

      {parDep.size > 1 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {Array.from(parDep.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([dep, x]) => {
            const pct = Math.round((x.ok / x.total) * 100)
            return (
              <div key={dep} className="bg-white border border-gray-200 rounded-lg p-3">
                <div className="text-xs text-gray-500 truncate">{dep}</div>
                <div className="text-lg font-bold text-gray-900">{pct}% <span className="text-xs font-normal text-gray-400">{x.ok}/{x.total}</span></div>
              </div>
            )
          })}
        </div>
      )}

      <ListeConfirmations
        lignes={lignes} titre={pol.titre} version={pol.version}
        filtreInitial={filtre === 'attente' ? 'attente' : filtre === 'confirmes' ? 'confirmes' : 'tous'}
      />

      {(versions ?? []).length > 1 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">{t('Historique des versions')}</h2>
          <ul className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 text-sm">
            {(versions ?? []).map(v => (
              <li key={v.version} className="px-5 py-3 flex flex-wrap gap-3 items-center">
                <span className="font-semibold w-10">v{v.version}</span>
                <span className="text-gray-500">{new Date(v.publiee_le).toLocaleDateString(loc, { dateStyle: 'medium' })}</span>
                <span className="text-gray-700 flex-1">{v.note_version ?? ''}</span>
                {urls[v.fichier] && <a href={urls[v.fichier]} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">📄 {v.nom_fichier ?? 'Document'}</a>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
