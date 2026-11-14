import Link from 'next/link'
import { redirect } from 'next/navigation'
import { i18n } from '@/lib/i18n/serveur'
import { getActeur, serviceClient } from '@/lib/permissions'
import { signerUrlsMedias } from '@/lib/medias-serveur'
import { chargerAppel, chargerEditions, couleurEdition, peutGererPasserelle } from '@/lib/passerelle'
import AppelForm from './AppelForm'

export const dynamic = 'force-dynamic'

// Administration → La Passerelle : éditions du journal (PDF), brouillons et encadré « On veut vous lire ! ».
export default async function PasserelleAdminPage() {
  const { t, loc } = await i18n()
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!peutGererPasserelle(acteur)) redirect('/admin')
  const sb = serviceClient()
  const [{ editions, migration }, appel] = await Promise.all([chargerEditions(sb, true), chargerAppel(sb)])
  const urls = await signerUrlsMedias(editions.map(e => e.couverture))
  const { data: lectures } = migration ? { data: [] } : await sb.from('passerelle_lectures').select('edition_id')
  const nbLectures = new Map<string, number>()
  for (const l of lectures ?? []) nbLectures.set(l.edition_id as string, (nbLectures.get(l.edition_id as string) ?? 0) + 1)

  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('La Passerelle')}</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">{t('Le journal de la clinique, dans le portail employé (WSSC). Déposez chaque édition en PDF : la couverture est créée à partir de la page 1. Une édition en brouillon n’est visible que par les administrateurs.')}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/passerelle" className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">{t('Voir comme un employé')}</Link>
          {!migration && <Link href="/admin/passerelle/nouvelle" className="text-sm font-semibold px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">+ {t('Nouvelle édition')}</Link>}
        </div>
      </div>
      {migration ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{t('Exécutez d’abord')} <code>supabase/migrations/passerelle.sql</code> {t('dans Supabase.')}</div>
      ) : (
        <>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
            {editions.length === 0 && <p className="p-8 text-center text-sm text-gray-500">{t('Aucune édition pour l’instant.')}</p>}
            {editions.map(e => {
              const k = couleurEdition(e.couleur)
              return (
                <Link key={e.id} href={`/admin/passerelle/${e.id}`} className="flex items-center gap-4 px-5 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  {urls[e.couverture]
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={urls[e.couverture]} alt="" className="w-12 rounded shadow-sm" style={{ borderTop: `3px solid ${k.accent}` }} />
                    : <span className="w-12 h-16 rounded" style={{ background: k.accent }} />}
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-gray-900">{t('Édition {n}', { n: e.numero })} · {t('Volume {n}', { n: e.volume })}</span>
                    <span className="block text-xs text-gray-500">{new Date(e.date_parution + 'T12:00:00').toLocaleDateString(loc, { dateStyle: 'long' })}{e.temps_lecture ? ' · ' + t('{n} min', { n: e.temps_lecture }) : ''}</span>
                  </span>
                  <span className="text-xs text-gray-500 whitespace-nowrap">{t('{n} lecteur(s)', { n: nbLectures.get(e.id) ?? 0 })}</span>
                  <span className={'text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ' + (e.publie ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600')}>{e.publie ? t('Publiée') : t('Brouillon')}</span>
                </Link>
              )
            })}
          </div>
          <AppelForm appel={appel} />
        </>
      )}
    </div>
  )
}
