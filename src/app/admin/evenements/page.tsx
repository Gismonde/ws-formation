import { FUSEAU } from '@/lib/fuseau'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActeur, serviceClient, peutCreerEvenements } from '@/lib/permissions'
import { i18n } from '@/lib/i18n/serveur'
import { evenementsDisponibles, placesRestantes, typeEvenement, peutArchiver, type Seance, type Inscription } from '@/lib/evenements'
import { evenementsGerables } from '@/lib/evenements-admin'

export const dynamic = 'force-dynamic'

export default async function EvenementsAdminPage({ searchParams }: { searchParams: Promise<{ archives?: string }> }) {
  const archives = (await searchParams).archives === '1'
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!peutCreerEvenements(acteur)) redirect('/admin')
  const { t, loc } = await i18n()
  const sb = serviceClient()
  if (!(await evenementsDisponibles(sb))) return <p className="text-sm text-amber-700">{t('Module événements non activé (migration manquante).')}</p>
  const tous = await evenementsGerables(sb, acteur)
  const evs = tous.filter(e => !!e.archive_le === archives)
  const nbArchives = tous.filter(e => !!e.archive_le).length
  const ids = evs.map(e => e.id)
  const [{ data: ss }, { data: ins }] = ids.length
    ? await Promise.all([sb.from('evenements_seances').select('*').in('evenement_id', ids).order('debut'), sb.from('evenements_inscriptions').select('seance_id, evenement_id, statut').in('evenement_id', ids)])
    : [{ data: [] }, { data: [] }]
  const seances = (ss ?? []) as Seance[]
  const inscriptions = (ins ?? []) as Inscription[]
  const date = (d: string) => new Date(d).toLocaleDateString(loc, { dateStyle: 'medium', timeZone: FUSEAU })
  const STATUT: Record<string, [string, string]> = { brouillon: [t('Brouillon'), 'bg-gray-100 text-gray-700'], publie: [t('Publié'), 'bg-green-100 text-green-800'], annule: [t('Annulé'), 'bg-red-100 text-red-700'] }

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Événements en présentiel')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('Séances de formation sur place : dates, places, inscriptions et présences.')}</p>
        </div>
        <Link href="/admin/evenements/nouveau" className="text-sm font-semibold px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">{t('+ Nouvel événement')}</Link>
      </div>
      <nav className="mb-4 flex gap-1 rounded-xl border border-gray-200 bg-white p-1 text-sm font-semibold w-fit">
        <Link href="/admin/evenements" className={'rounded-lg px-4 py-2 ' + (!archives ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:text-gray-900')}>{t('Événements')}</Link>
        <Link href="/admin/evenements?archives=1" className={'rounded-lg px-4 py-2 ' + (archives ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:text-gray-900')}>🗄️ {t('Archivés')} {nbArchives ? <span className="ml-1 rounded-full bg-black/10 px-1.5 text-xs">{nbArchives}</span> : null}</Link>
      </nav>
      {evs.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center text-sm text-gray-500">{archives ? t('Aucun événement archivé.') : t('Aucun événement pour le moment.')}</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {evs.map(ev => {
            const sev = seances.filter(s => s.evenement_id === ev.id && !s.annulee)
            const prochaines = sev.filter(s => new Date(s.fin).getTime() > Date.now())
            const places = sev.reduce((n, s) => n + s.places, 0)
            const inscrits = sev.reduce((n, s) => n + (s.places - placesRestantes(s, inscriptions.filter(i => i.evenement_id === ev.id))), 0)
            const attente = inscriptions.filter(i => i.evenement_id === ev.id && i.statut === 'attente').length
            const [l, cls] = STATUT[ev.statut] ?? STATUT.brouillon
            return (
              <Link key={ev.id} href={`/admin/evenements/${ev.id}`} className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                {ev.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={ev.image} alt="" className="h-32 w-full object-cover" /> : <div className="h-32 bg-indigo-50 flex items-center justify-center text-4xl">📅</div>}
                <div className="p-4 flex-1 flex flex-col gap-2">
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className={'text-xs font-semibold px-2 py-0.5 rounded-full ' + cls}>{l}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: typeEvenement(ev).fond, color: typeEvenement(ev).couleur }}>{typeEvenement(ev).emoji} {t(typeEvenement(ev).court)}</span>
                    {!archives && 'archive_le' in ev && peutArchiver(ev, seances.filter(s => s.evenement_id === ev.id)) && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">🗄️ {t('À archiver')}</span>}
                    {ev.en_vedette && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">⭐ {t('En vedette')}</span>}
                    {ev.obligatoire && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">{t('Obligatoire')}</span>}
                  </div>
                  <p className="font-semibold text-gray-900">{ev.titre}</p>
                  <p className="text-xs text-gray-500">
                    {prochaines.length ? t('{n} date(s) à venir · prochaine le {date}', { n: prochaines.length, date: date(prochaines[0].debut) }) : t('Aucune date à venir')}
                  </p>
                  <p className="text-xs text-gray-600">{t('{i} / {p} place(s) prise(s)', { i: inscrits, p: places })}{attente ? ' · ' + t('{n} en liste d’attente', { n: attente }) : ''}</p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
