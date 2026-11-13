// Onglet « Employés assignés » d'une formation : à qui elle est assignée, où ils en sont, et « Désassigner ».
import Link from 'next/link'
import { i18n } from '@/lib/i18n/serveur'
import { serviceClient, type Acteur } from '@/lib/permissions'
import { statistiquesFormation } from '@/lib/statistiques-formation'
import { LIBELLE_STATUT } from '@/lib/etat-formations'
import DesassignerFormation from '@/components/DesassignerFormation'

const COULEUR_STATUT: Record<string, string> = { non_commence: 'bg-gray-100 text-gray-600', en_cours: 'bg-amber-50 text-amber-700', termine: 'bg-indigo-50 text-indigo-700', certifie: 'bg-green-50 text-green-700' }

export default async function AssignesFormation({ acteur, formationId, titre }: { acteur: Acteur; formationId: string; titre: string }) {
  const { t, loc } = await i18n()
  const s = await statistiquesFormation(serviceClient(), acteur, formationId)
  const lignes = s.employes.filter(e => e.formation_id === formationId)
  const jour = (d: string | null) => (d ? new Date(d.length === 10 ? d + 'T12:00:00' : d).toLocaleDateString(loc, { dateStyle: 'medium' }) : '—')

  if (lignes.length === 0) return (
    <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-sm text-gray-400">
      {t('Cette formation n’est assignée à aucun employé que vous suivez.')}{' '}
      <Link href={`/admin/formations/${formationId}/assigner`} className="text-indigo-600 hover:underline">{t('Assigner')}</Link>
    </div>
  )

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-base font-semibold text-gray-900">{t('Employés assignés')} ({lignes.length})</h2>
        <p className="text-xs text-gray-500">{t('Désassigner retire la formation de ses formations, sans courriel. La progression et les certificats sont conservés.')}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead><tr className="text-left text-xs text-gray-500 bg-gray-50">
            <th className="px-6 py-2.5">{t('Employé')}</th><th className="px-3 py-2.5">{t('Département')}</th><th className="px-3 py-2.5">{t('Statut')}</th>
            <th className="px-3 py-2.5">{t('Progression')}</th><th className="px-3 py-2.5">{t('Assignée le')}</th><th className="px-3 py-2.5">{t('Échéance')}</th><th className="px-3 py-2.5" />
          </tr></thead>
          <tbody>
            {lignes.map(e => (
              <tr key={e.id} className="border-t border-gray-100">
                <td className="px-6 py-2.5"><Link href={`/admin/employes/${e.id}?onglet=formations`} className="text-gray-900 hover:text-indigo-700 font-medium">{e.nom}</Link></td>
                <td className="px-3 py-2.5 text-gray-600">{e.departement}</td>
                <td className="px-3 py-2.5"><span className={'text-xs font-semibold px-2 py-0.5 rounded-full ' + COULEUR_STATUT[e.statut]}>{t(LIBELLE_STATUT[e.statut])}</span></td>
                <td className="px-3 py-2.5 text-gray-600">{e.progression} %</td>
                <td className="px-3 py-2.5 text-gray-600">{jour(e.date_assignation)}</td>
                <td className={'px-3 py-2.5 ' + (e.en_retard ? 'text-red-600 font-semibold' : 'text-gray-600')}>{jour(e.date_echeance)}{e.en_retard ? ' · ' + t('en retard') : ''}</td>
                <td className="px-3 py-2.5 text-right">{e.id !== acteur.id && <DesassignerFormation employeId={e.id} formationId={formationId} nomEmploye={e.nom} titreFormation={titre} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
