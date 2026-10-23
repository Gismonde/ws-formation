import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActeur, serviceClient } from '@/lib/permissions'
import { estAdministrateur } from '@/lib/cliniques'
import { peutTraiterSuggestion, STATUTS_SUGGESTION, TYPES_SUGGESTION, type Suggestion } from '@/lib/suggestions'
import TraiterSuggestion from './TraiterSuggestion'
import { i18n } from '@/lib/i18n/serveur'

// Suggestions des employés : demandes de formation et commentaires (administrateurs de la clinique),
// idées pour la plateforme (administrateur global).
export default async function SuggestionsAdminPage({ searchParams }: { searchParams: Promise<{ statut?: string; type?: string }> }) {
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!estAdministrateur(acteur.role)) redirect('/admin')
  const { t, loc } = await i18n()
  const sp = await searchParams
  const sb = serviceClient()
  const { data, error } = await sb.from('suggestions').select('*').order('created_at', { ascending: false }).limit(500)
  const visibles = ((data ?? []) as Suggestion[]).filter(s => peutTraiterSuggestion(acteur, s))
  const liste = visibles.filter(s => (!sp.statut ? s.statut !== 'realisee' && s.statut !== 'refusee' : sp.statut === 'toutes' || s.statut === sp.statut) && (!sp.type || s.type === sp.type))
  const ids = Array.from(new Set(liste.flatMap(s => [s.employe_id, s.formation_id]).filter(Boolean))) as string[]
  const [{ data: emps }, { data: fos }] = await Promise.all([
    ids.length ? sb.from('employes').select('id, prenom, nom').in('id', ids) : Promise.resolve({ data: [] as { id: string; prenom: string; nom: string }[] }),
    ids.length ? sb.from('formations').select('id, titre').in('id', ids) : Promise.resolve({ data: [] as { id: string; titre: string }[] }),
  ])
  const nom = (id: string | null) => { const e = (emps ?? []).find(x => x.id === id); return e ? `${e.prenom ?? ''} ${e.nom ?? ''}`.trim() : null }
  const formation = (id: string | null) => (fos ?? []).find(x => x.id === id)
  const lien = (p: Record<string, string | undefined>) => '/admin/suggestions?' + new URLSearchParams(Object.entries({ ...sp, ...p }).filter(([, v]) => v) as [string, string][]).toString()
  const compte = (st: string) => visibles.filter(s => s.statut === st).length
  const puce = (actif: boolean) => 'text-sm px-3 py-1.5 rounded-full border ' + (actif ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50')

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900">💡 {t('Suggestions des employés')}</h1>
      <p className="text-sm text-gray-500 mt-1 mb-5">
        {acteur.role === 'super_admin' ? t('Demandes de formation, commentaires et idées pour la plateforme.') : t('Demandes de formation et commentaires des employés de votre clinique. Les idées pour la plateforme vont à l’administrateur global.')}
      </p>
      {error ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{t('Exécutez d’abord')} <code>supabase/migrations/suggestions.sql</code> {t('dans Supabase.')}</p> : (
        <>
          <div className="flex flex-wrap gap-2 mb-2">
            <Link href={lien({ statut: undefined })} className={puce(!sp.statut)}>{t('À traiter')} ({visibles.filter(s => s.statut !== 'realisee' && s.statut !== 'refusee').length})</Link>
            {STATUTS_SUGGESTION.map(x => <Link key={x.id} href={lien({ statut: x.id })} className={puce(sp.statut === x.id)}>{t(x.libelle)} ({compte(x.id)})</Link>)}
            <Link href={lien({ statut: 'toutes' })} className={puce(sp.statut === 'toutes')}>{t('Toutes')}</Link>
          </div>
          <div className="flex flex-wrap gap-2 mb-5">
            <Link href={lien({ type: undefined })} className={puce(!sp.type)}>{t('Tous les types')}</Link>
            {TYPES_SUGGESTION.filter(x => x.id !== 'plateforme' || acteur.role === 'super_admin').map(x => <Link key={x.id} href={lien({ type: x.id })} className={puce(sp.type === x.id)}>{x.icone} {t(x.libelle)}</Link>)}
          </div>
          {liste.length === 0 ? <p className="text-sm text-gray-400">{t('Aucune suggestion ici.')}</p> : (
            <ul className="space-y-3">
              {liste.map(s => {
                const ty = TYPES_SUGGESTION.find(x => x.id === s.type)!
                const st = STATUTS_SUGGESTION.find(x => x.id === s.statut)!
                const f = formation(s.formation_id)
                return (
                  <li key={s.id} className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span>{ty.icone}</span>
                      <span className="font-semibold text-gray-900">{s.sujet || (f ? f.titre : t(ty.libelle))}</span>
                      {f && <Link href={`/admin/formations/${f.id}`} className="text-xs text-indigo-600 hover:underline">{t('Voir la formation')}</Link>}
                      <span className={'ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ' + st.couleur}>{t(st.libelle)}</span>
                    </div>
                    <p className="text-sm text-gray-700 mt-2 whitespace-pre-line">{s.message}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      {t(ty.libelle)} · {new Date(s.created_at).toLocaleDateString(loc, { dateStyle: 'medium' })} · {s.anonyme ? t('Anonyme') : (nom(s.employe_id) ?? '—')}{s.clinique && s.clinique !== 'LES_DEUX' ? ' · ' + s.clinique : ''}
                    </p>
                    <TraiterSuggestion id={s.id} statut={s.statut} reponse={s.reponse} anonyme={s.anonyme} />
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
