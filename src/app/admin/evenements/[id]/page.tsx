import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getActeur, serviceClient } from '@/lib/permissions'
import { i18n } from '@/lib/i18n/serveur'
import { chargerEvenement, placesRestantes } from '@/lib/evenements'
import { peutGererEvenement } from '@/lib/evenements-admin'
import { publicDe } from '@/lib/politiques-affichage'
import GestionEvenement from './GestionEvenement'

export const dynamic = 'force-dynamic'

export default async function EvenementAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  const sb = serviceClient()
  const d = await chargerEvenement(sb, id)
  if (!d || !peutGererEvenement(acteur, d.ev)) notFound()
  const { t } = await i18n()
  const { ev, seances, inscriptions } = d
  const ids = Array.from(new Set(inscriptions.map(i => i.employe_id)))
  const [{ data: emps }, { data: deps }, { data: formation }] = await Promise.all([
    ids.length ? sb.from('employes').select('id, prenom, nom, email, poste').in('id', ids) : Promise.resolve({ data: [] as { id: string; prenom: string | null; nom: string | null; email: string | null; poste: string | null }[] }),
    sb.from('departements').select('id, nom'),
    ev.formation_id ? sb.from('formations').select('id, titre').eq('id', ev.formation_id).maybeSingle() : Promise.resolve({ data: null }),
  ])
  const noms = new Map((deps ?? []).map(x => [x.id as string, x.nom as string]))
  const personnes = Object.fromEntries((emps ?? []).map(e => [e.id, { nom: `${e.prenom ?? ''} ${e.nom ?? ''}`.trim() || (e.email ?? ''), poste: e.poste ?? '' }]))

  return (
    <div className="max-w-5xl">
      <Link href="/admin/evenements" className="text-sm text-gray-500 hover:text-gray-700">{t('← Événements')}</Link>
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mt-3 mb-6">
        {ev.image && /* eslint-disable-next-line @next/next/no-img-element */ <img src={ev.image} alt="" className="w-full max-h-64 object-cover" />}
        <div className="p-6">
          <div className="flex flex-wrap gap-2 mb-2">
            <span className={'text-xs font-semibold px-2.5 py-1 rounded-full ' + (ev.statut === 'publie' ? 'bg-green-100 text-green-800' : ev.statut === 'annule' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700')}>
              {ev.statut === 'publie' ? t('Publié') : ev.statut === 'annule' ? t('Annulé') : t('Brouillon')}
            </span>
            {ev.obligatoire && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">{t('Obligatoire')}</span>}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{ev.titre}</h1>
          <p className="text-sm text-gray-500 mt-1">{publicDe(ev, noms, t)}</p>
          <div className="text-sm text-gray-700 mt-3 space-y-1">
            {ev.lieu && <p>📍 {ev.lieu}</p>}
            {ev.responsable && <p>👤 {ev.responsable}</p>}
            {formation && <p>🎓 {t('Compte comme la formation :')} <Link href={`/admin/formations/${formation.id}`} className="text-indigo-700 hover:underline">{formation.titre}</Link></p>}
            {ev.duree_minutes && <p>⏱ {t('{n} minutes de formation', { n: ev.duree_minutes })}</p>}
          </div>
          {ev.description && <p className="text-sm text-gray-600 mt-3 whitespace-pre-line">{ev.description}</p>}
        </div>
      </div>

      <GestionEvenement
        evenement={{ id: ev.id, titre: ev.titre, statut: ev.statut, aFormation: !!ev.formation_id }}
        seances={seances.map(s => ({ ...s, restantes: placesRestantes(s, inscriptions) }))}
        inscriptions={inscriptions.filter(i => i.statut !== 'annule').map(i => ({ id: i.id, seance_id: i.seance_id, employe_id: i.employe_id, statut: i.statut, present: i.present, inscrit_le: i.inscrit_le, ...(personnes[i.employe_id] ?? { nom: '—', poste: '' }) }))}
      />
    </div>
  )
}
