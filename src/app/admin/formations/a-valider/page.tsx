// Formations à valider (celles dont je suis le validateur) et suivi de mes demandes de validation.
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActeur, serviceClient, peutValiderFormations, peutCreerFormations } from '@/lib/permissions'
import { i18n } from '@/lib/i18n/serveur'
import { statutDe, type FormationValidation, type StatutValidation } from '@/lib/validation-formation'

export const dynamic = 'force-dynamic'

export default async function AValiderPage() {
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!peutValiderFormations(acteur) && !peutCreerFormations(acteur)) redirect('/admin')
  const { t, loc } = await i18n()
  const sb = serviceClient()
  const [{ data: aValider }, { data: mesDemandes }] = await Promise.all([
    sb.from('formations').select('*').eq('validateur_id', acteur.id).eq('statut_validation', 'en_validation').order('validation_demandee_le'),
    sb.from('formations').select('*').eq('validation_demandee_par', acteur.id).in('statut_validation', ['en_validation', 'a_modifier', 'approuvee']).order('validation_demandee_le', { ascending: false }).limit(50),
  ])
  const formations = [...(aValider ?? []), ...(mesDemandes ?? [])] as FormationValidation[]
  const ids = Array.from(new Set(formations.flatMap(f => [f.validateur_id, f.validation_demandee_par]).filter(Boolean))) as string[]
  const { data: noms } = ids.length ? await sb.from('employes').select('id, prenom, nom').in('id', ids) : { data: [] as { id: string; prenom: string | null; nom: string | null }[] }
  const nom = (i?: string | null) => { const e = (noms ?? []).find(x => x.id === i); return e ? `${e.prenom ?? ''} ${e.nom ?? ''}`.trim() : '—' }
  const date = (d?: string | null) => (d ? new Date(d).toLocaleDateString(loc, { dateStyle: 'medium' }) : '—')
  const demandes = ((mesDemandes ?? []) as FormationValidation[]).filter(f => !(statutDe(f) === 'approuvee' && f.publiee))
  const badge: Record<StatutValidation, [string, string]> = {
    brouillon: [t('Brouillon'), 'bg-gray-100 text-gray-700'],
    en_validation: [t('En attente'), 'bg-amber-100 text-amber-800'],
    a_modifier: [t('Modifications demandées'), 'bg-red-100 text-red-700'],
    approuvee: [t('Approuvée — à publier'), 'bg-green-100 text-green-800'],
  }
  const carte = 'bg-white border border-gray-200 rounded-2xl p-5'

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('Formations à valider')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('Aucune formation n’est publiée ni assignée sans l’approbation d’une autre personne.')}</p>
      </div>

      <section className={carte}>
        <h2 className="font-semibold text-gray-900 mb-3">{t('À valider par moi')} <span className="text-sm font-normal text-gray-400">({aValider?.length ?? 0})</span></h2>
        {(aValider ?? []).length === 0 ? <p className="text-sm text-gray-400">✓ {t('Aucune formation en attente de votre validation.')}</p> : (
          <ul className="divide-y divide-gray-100">
            {((aValider ?? []) as FormationValidation[]).map(f => (
              <li key={f.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/admin/formations/${f.id}`} className="font-medium text-gray-900 hover:text-indigo-700">{f.titre}</Link>{f.copie_de && <span className="ml-2 text-xs font-semibold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">✏️ {t('Copie de travail')}</span>}
                  <p className="text-xs text-gray-500">{t('Demandée par {qui} le {date}', { qui: nom(f.validation_demandee_par), date: date(f.validation_demandee_le) })}</p>
                  {f.validation_commentaire && <p className="text-xs text-gray-600 mt-1">💬 {f.validation_commentaire}</p>}
                </div>
                <div className="flex gap-2">
                  <a href={`/api/admin/formations/${f.id}/mode-employe?retour=fiche`} className="text-sm px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-900">👁 {t('Mode employé')}</a>
                  <Link href={`/admin/formations/${f.id}`} className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 text-white">{t('Valider')}</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {peutCreerFormations(acteur) && (
        <section className={carte}>
          <h2 className="font-semibold text-gray-900 mb-3">{t('Mes demandes de validation')} <span className="text-sm font-normal text-gray-400">({demandes.length})</span></h2>
          {demandes.length === 0 ? <p className="text-sm text-gray-400">{t('Aucune demande en cours.')}</p> : (
            <ul className="divide-y divide-gray-100">
              {demandes.map(f => {
                const [libelle, cls] = badge[statutDe(f)]
                return (
                  <li key={f.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/admin/formations/${f.id}`} className="font-medium text-gray-900 hover:text-indigo-700">{f.titre}</Link>{f.copie_de && <span className="ml-2 text-xs font-semibold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">✏️ {t('Copie de travail')}</span>}
                      <p className="text-xs text-gray-500">{t('Validateur : {qui}', { qui: nom(f.validateur_id) })} · {date(f.validation_demandee_le)}</p>
                    </div>
                    <span className={'text-xs font-semibold px-2.5 py-1 rounded-full ' + cls}>{libelle}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
