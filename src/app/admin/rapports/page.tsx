import { i18n } from '@/lib/i18n/serveur'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActeur, serviceClient, cliniquesAdministrees } from '@/lib/permissions'
import { aAccesAdmin, CLINIQUE_INFO, estCliniqueEmploye } from '@/lib/cliniques'
import { chargerConformite, synthese, rapportParFormation, formationsDuRapport } from '@/lib/conformite'

export default async function AdminRapportsPage() {
  const { t } = await i18n()
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!aAccesAdmin(acteur.role)) redirect('/dashboard/accueil')
  const sb = serviceClient()
  const perimetre = acteur.role === 'super_admin' && !acteur.vue ? null
    : acteur.role === 'gestionnaire' ? t('Vous consultez les données de votre département uniquement.')
    : t('Vous consultez les données de {cliniques} uniquement.', { cliniques: cliniquesAdministrees(acteur).join(t(' et ')) })

  const [donnees, formations] = await Promise.all([chargerConformite(sb, acteur), formationsDuRapport(sb, acteur)])
  const s = synthese(donnees)
  const lignes = rapportParFormation(donnees, formations)

  // Derniers certificats émis (dans le périmètre)
  const derniers = donnees
    .flatMap(e => e.assignations.filter(a => a.certificat?.date_emission).map(a => ({ e, a })))
    .sort((x, y) => (y.a.certificat!.date_emission! > x.a.certificat!.date_emission! ? 1 : -1))
    .slice(0, 8)

  const stats = [
    { label: 'Formations publiées', value: formations.length, icon: '📚' },
    { label: 'Employés actifs', value: s.employes, icon: '👥' },
    { label: 'Taux de complétion', value: s.taux + ' %', icon: '📈' },
    { label: 'Certificats valides', value: s.certificats, icon: '🏆' },
    { label: 'Formations en retard', value: s.en_retard, icon: '⏰' },
  ]

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Rapports')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('Progression par formation, dans votre périmètre.')}</p>
        </div>
        <div className="flex gap-2">
          <a href="/api/admin/rapports/export?format=xlsx" className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">{t('⬇ Excel')}</a>
          <a href="/api/admin/rapports/export?format=pdf" className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">{t('⬇ PDF')}</a>
        </div>
      </div>
      {perimetre && (
        <p className="text-sm text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-4 py-2 mb-6">{perimetre}</p>
      )}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {stats.map(st => (
          <div key={st.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-2xl mb-2">{st.icon}</div>
            <div className="text-2xl font-bold text-gray-900">{st.value}</div>
            <div className="text-sm text-gray-500 mt-1">{t(st.label)}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 mb-6 overflow-x-auto">
        <h2 className="text-base font-semibold text-gray-800 px-6 pt-5 pb-3">{t('Progression par formation')}</h2>
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="bg-gray-50 text-xs uppercase text-gray-500">
              <th className="text-left px-6 py-3 font-semibold">{t('Formation')}</th>
              <th className="text-center px-3 py-3 font-semibold">{t('Assignés')}</th>
              <th className="text-center px-3 py-3 font-semibold">{t('Complétés')}</th>
              <th className="text-center px-3 py-3 font-semibold">{t('En cours')}</th>
              <th className="text-center px-3 py-3 font-semibold">{t('En retard')}</th>
              <th className="text-left px-3 py-3 font-semibold w-48">{t('Taux')}</th>
            </tr>
          </thead>
          <tbody>
            {lignes.length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">{t('Aucune formation publiée')}</td></tr>}
            {lignes.map(l => (
              <tr key={l.formation_id} className="border-t border-gray-100">
                <td className="px-6 py-3">
                  <div className="font-medium text-gray-900">{l.titre}{l.obligatoire && <span className="ml-2 text-[10px] font-bold text-red-600">{t('LSST')}</span>}</div>
                  <div className="text-xs text-gray-400">
                    {[l.categorie, l.clinique === 'LES_DEUX' ? 'CMC + WSSC' : estCliniqueEmploye(l.clinique) ? CLINIQUE_INFO[l.clinique as 'CMC' | 'WSSC'].court : null].filter(Boolean).join(' · ')}
                  </div>
                </td>
                <td className="text-center px-3 py-3 text-gray-700">{l.assignes}</td>
                <td className="text-center px-3 py-3 text-green-700 font-semibold">{l.completes}</td>
                <td className="text-center px-3 py-3 text-amber-700">{l.en_cours}</td>
                <td className={'text-center px-3 py-3 ' + (l.en_retard ? 'text-red-700 font-semibold' : 'text-gray-400')}>{l.en_retard}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 bg-gray-100 rounded-full flex-1">
                      <div className="h-1.5 bg-indigo-400 rounded-full" style={{ width: `${l.taux}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 w-10 text-right">{l.assignes ? l.taux + ' %' : '—'}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">{t('Derniers certificats émis')}</h2>
        {derniers.length === 0 ? (
          <p className="text-gray-400 text-sm">{t('Aucun certificat encore')}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {derniers.map(({ e, a }) => (
              <li key={e.id + a.formation_id} className="py-2 flex flex-wrap justify-between gap-2 text-sm">
                <span><Link href={`/admin/employes/${e.id}`} className="font-medium text-gray-900 hover:underline">{e.prenom} {e.nom}</Link> — {a.formation_titre}</span>
                <span className="text-gray-400">{new Date(a.certificat!.date_emission!).toLocaleDateString('fr-CA', { dateStyle: 'medium' })}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
