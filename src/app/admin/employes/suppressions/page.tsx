import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActeur, serviceClient } from '@/lib/permissions'
import { CLINIQUE_INFO, ROLE_LABEL, estCliniqueContenu } from '@/lib/cliniques'
import { peutSupprimerEmployes, type Suppression } from '@/lib/suppression-employes'
import SupprimerArchives from './SupprimerArchives'

const TABLES: Record<string, string> = {
  assignations: 'assignations', progressions: 'progressions', lesson_progressions: 'leçons suivies', tentatives_questionnaire: 'tentatives',
  certificats: 'certificats', preuves_externes: 'preuves externes', preuves_lecture: 'preuves de lecture',
  politiques_confirmations: 'politiques confirmées', sondage_reponses: 'réponses de sondage',
}

export default async function SuppressionsPage() {
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!peutSupprimerEmployes(acteur)) redirect('/admin/employes')

  const sb = serviceClient()
  const [{ data: archives }, { data: historique, error }] = await Promise.all([
    sb.from('employes').select('id, prenom, nom, email, role, clinique').eq('actif', false).order('nom'),
    sb.from('suppressions_employes').select('*').order('supprime_le', { ascending: false }).limit(500),
  ])
  const migration = !!error && /suppressions_employes/.test(error.message)
  const clinique = (c: string | null) => c === 'LES_DEUX' ? 'CMC + WSSC' : estCliniqueContenu(c) && c !== 'LES_DEUX' ? CLINIQUE_INFO[c].court : '—'

  return (
    <div className="max-w-6xl">
      <Link href="/admin/employes" className="text-sm text-gray-500 hover:text-gray-800">← Employés</Link>
      <h1 className="text-2xl font-bold text-gray-900 mt-2">Suppression définitive des employés archivés</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6 max-w-3xl">
        Réservé aux administrateurs globaux. La suppression efface le compte et toutes les données de formation de la personne
        (assignations, progression, certificats, preuves, confirmations de politiques). Elle est irréversible.
        Chaque suppression est conservée ci-dessous avec sa raison.
      </p>

      {migration ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 mb-8">Exécutez d’abord <code>supabase/migrations/suppressions_employes.sql</code> dans Supabase.</div>
      ) : (
        <SupprimerArchives employes={(archives ?? []).map(e => ({ id: e.id, nom: [e.prenom, e.nom].filter(Boolean).join(' ') || '—', email: e.email, detail: [ROLE_LABEL[e.role as keyof typeof ROLE_LABEL] ?? e.role, clinique(e.clinique)].join(' · ') }))} />
      )}

      <h2 className="text-lg font-semibold text-gray-900 mt-10 mb-3">Traçabilité des suppressions</h2>
      {(historique ?? []).length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">Aucune suppression.</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase text-gray-500 text-left">
                <th className="px-4 py-2.5 font-semibold">Date</th>
                <th className="px-3 py-2.5 font-semibold">Employé supprimé</th>
                <th className="px-3 py-2.5 font-semibold">Raison</th>
                <th className="px-3 py-2.5 font-semibold">Données effacées</th>
                <th className="px-3 py-2.5 font-semibold">Par</th>
              </tr>
            </thead>
            <tbody>
              {(historique as Suppression[]).map(s => (
                <tr key={s.id} className="border-t border-gray-100 align-top">
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{new Date(s.supprime_le).toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Toronto' })}</td>
                  <td className="px-3 py-2.5"><div className="font-medium text-gray-900">{[s.prenom, s.nom].filter(Boolean).join(' ') || '—'}</div><div className="text-xs text-gray-500">{s.email} · {clinique(s.clinique)}</div></td>
                  <td className="px-3 py-2.5 text-gray-700 max-w-sm">{s.raison}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-500">{Object.entries(s.resume ?? {}).map(([t, n]) => `${n} ${TABLES[t] ?? t}`).join(', ') || 'aucune'}</td>
                  <td className="px-3 py-2.5 text-gray-600">{s.supprime_par_nom ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
