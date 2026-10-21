import { i18n } from '@/lib/i18n/serveur'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getFormationWithModules } from '@/lib/actions/formations'
import { getLessonsWithBlocks } from '@/lib/actions/lessons'
import type { Formation, Module } from '@/lib/types/formation'
import { getActeur, peutCreerFormations, cliniquesContenuGerables } from '@/lib/permissions'
import { CLINIQUE_INFO, estCliniqueContenu } from '@/lib/cliniques'
import { titreAttendu } from '@/lib/brancher-librairie'
import BrancherLibrairie from './BrancherLibrairie'
import BoutonPublier from './BoutonPublier'
import DupliquerFormation from './DupliquerFormation'
import NouvelleVersion from './NouvelleVersion'
import { serviceClient } from '@/lib/permissions'
import { historiqueFormation } from '@/lib/historique-formation'

type ModuleAvecLecons = Module & { lecons: { id: string; titre: string; ordre: number; blocs: { id: string }[] }[] }

export default async function AdminFormationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { t } = await i18n()
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: emp } = await supabase.from('employes').select('role').eq('auth_user_id', user.id).single()
  if (!emp || !['super_admin', 'admin', 'gestionnaire'].includes(emp.role)) redirect('/dashboard/accueil')

  const acteurCourant = await getActeur()
  const { loc } = await i18n()
  const peutCreer = peutCreerFormations(acteurCourant)
  const historique = peutCreer ? await historiqueFormation(id) : []
  const { data: versionsBrutes } = await serviceClient().from('formations_versions').select('version, publiee_le, note, employes(prenom, nom)').eq('formation_id', id).order('version', { ascending: false })
  const versions = (versionsBrutes ?? []).map(v => {
    const e = v.employes as { prenom?: string; nom?: string } | { prenom?: string; nom?: string }[] | null
    const p = Array.isArray(e) ? e[0] : e
    return { version: v.version as number, le: v.publiee_le as string, note: (v.note as string | null) ?? '', par: [p?.prenom, p?.nom].filter(Boolean).join(' ') }
  })
  const date = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString(loc, { dateStyle: 'long', timeZone: 'America/Toronto' }) : null)

  const res = await getFormationWithModules(id)
  if (!res.success || !res.data) notFound()
  const formation = res.data as Formation & { modules: Module[] }
  const suivi = formation as unknown as { publiee_le?: string | null; version?: number; version_le?: string | null }

  // Charger les leçons de chaque module
  const modulesAvecLecons: ModuleAvecLecons[] = []
  let totalLecons = 0
  let totalBlocs = 0
  let enAttente = 0
  for (const mod of (formation.modules || [])) {
    const lr = await getLessonsWithBlocks(mod.id)
    const lecons = lr.success ? (lr.data as ModuleAvecLecons['lecons']) : []
    totalLecons += lecons.length
    lecons.forEach(l => { totalBlocs += (l.blocs?.length || 0) })
    lecons.forEach(l => { enAttente += ((l.blocs ?? []) as { type?: string; contenu?: string | null }[]).filter(b => b.type === 'text' && titreAttendu(b.contenu) !== null).length })
    modulesAvecLecons.push({ ...mod, lecons })
  }

  const niveauStyles: Record<string, { bg: string; color: string; label: string }> = {
    debutant: { bg: '#f0fdf4', color: '#16a34a', label: 'Débutant' },
    intermediaire: { bg: '#fefce8', color: '#ca8a04', label: 'Intermédiaire' },
    avance: { bg: '#fff1f2', color: '#e11d48', label: 'Avancé' },
  }
  const niveauStyle = niveauStyles[formation.niveau || ''] || { bg: '#f3f4f6', color: '#6b7280', label: formation.niveau || '' }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Fil d'Ariane */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/admin/formations" className="hover:text-gray-700">{t('Formations')}</Link>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-gray-800 font-medium truncate">{formation.titre}</span>
        </nav>

        {/* En-tête */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: niveauStyle.bg, color: niveauStyle.color }}
                >
                  {t(niveauStyle.label)}
                </span>
                {formation.publiee ? (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-700">{t('Publiée')}</span>
                ) : (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-yellow-50 text-yellow-700">{t('Brouillon')}</span>
                )}
                {formation.categorie && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">{formation.categorie}</span>
                )}
                {estCliniqueContenu(formation.clinique) && (formation.clinique === 'LES_DEUX'
                  ? <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">{t('CMC + WSSC')}</span>
                  : <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: CLINIQUE_INFO[formation.clinique].fond, color: CLINIQUE_INFO[formation.clinique].couleur }}>{CLINIQUE_INFO[formation.clinique].nom}</span>)}
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{formation.titre}</h1>
              {suivi.publiee_le && (
                <p className="text-sm text-gray-500 mb-2">
                  {t('Publiée initialement le {date}', { date: date(suivi.publiee_le)! })}
                  {' · '}<span className="font-semibold text-gray-700">{t('Version {n}', { n: suivi.version ?? 1 })}</span>
                  {(suivi.version ?? 1) > 1 && suivi.version_le ? ' · ' + t('mise à jour le {date}', { date: date(suivi.version_le)! }) : ''}
                </p>
              )}
              {formation.description && (
                <p className="text-gray-600 leading-relaxed">{formation.description}</p>
              )}
            </div>
            {peutCreer && (
              <div className="flex items-start gap-2">
                {formation.publiee && suivi.publiee_le && <NouvelleVersion formationId={id} version={suivi.version ?? 1} />}
                <DupliquerFormation formationId={id} titre={formation.titre} clinique={(formation.clinique ?? 'LES_DEUX') as 'CMC' | 'WSSC' | 'LES_DEUX'} cliniques={acteurCourant ? cliniquesContenuGerables(acteurCourant) : []} />
                <BoutonPublier formationId={id} publiee={!!formation.publiee} enAttente={enAttente} />
              </div>
            )}
          </div>

          {/* Statistiques */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-5 pt-5 border-t border-gray-100">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{formation.modules?.length || 0}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t('Modules')}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{totalLecons}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t('Leçons')}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{totalBlocs}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t('Blocs de contenu')}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{formation.duree_estimee_minutes || 0}'</p>
              <p className="text-xs text-gray-500 mt-0.5">{t('Durée estimée')}</p>
            </div>
                          <div className="text-center">
                <p className="text-2xl font-bold text-amber-600">
                  {formation.validite_mois
                    ? formation.validite_mois >= 12
                      ? `${Math.floor(formation.validite_mois / 12)}a${formation.validite_mois % 12 > 0 ? ` ${formation.validite_mois % 12}m` : ''}`
                      : `${formation.validite_mois}m`
                    : '∞'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{t('Validité certificat')}</p>
              </div>
            
          </div>
        </div>

        {/* Actions principales */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          {peutCreer && (
            <Link
              href={"/admin/formations/" + id + "/editeur"}
              className="flex flex-col items-center gap-2 p-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-center"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span className="text-sm font-semibold">{t('Éditeur de cours')}</span>
              <span className="text-xs text-blue-200">{t('Modules et leçons')}</span>
            </Link>
          )}
          {peutCreer && (
            <Link
              href={"/admin/formations/" + id + "/modifier"}
              className="flex flex-col items-center gap-2 p-4 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors text-center"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-sm font-semibold">{t('Paramètres')}</span>
              <span className="text-xs text-gray-400">{t('Titre, niveau, durée')}</span>
            </Link>
          )}
          <Link
            href={"/admin/formations/" + id + "/assigner"}
            className="flex flex-col items-center gap-2 p-4 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors text-center"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="text-sm font-semibold">{t('Assigner')}</span>
            <span className="text-xs text-gray-400">{t('Employés / départements')}</span>
          </Link>
          <Link
            href={"/admin/formations/" + id + "/apercu"}
            className="flex flex-col items-center gap-2 p-4 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors text-center"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span className="text-sm font-semibold">{t('Aperçu')}</span>
            <span className="text-xs text-gray-400">{t('Vue employé')}</span>
          </Link>
          {(formation as { delivre_certificat?: boolean }).delivre_certificat !== false && (
            <Link
              href={"/certificat/apercu/" + id}
              className="flex flex-col items-center gap-2 p-4 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors text-center"
            >
              <span className="text-2xl leading-6">🏆</span>
              <span className="text-sm font-semibold">{t('Aperçu du certificat')}</span>
              <span className="text-xs text-gray-400">{t('Vérifier le titre')}</span>
            </Link>
          )}
        </div>

        {peutCreer && enAttente > 0 && <BrancherLibrairie formationId={id} enAttente={enAttente} />}

        {/* Structure du cours */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">{t('Structure du cours')}</h2>
            {peutCreer && (
              <Link
                href={"/admin/formations/" + id + "/editeur"}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                {t('Modifier')}
              </Link>
            )}
          </div>

          {modulesAvecLecons.length === 0 ? (
            <div className="py-12 text-center">
              <div className="text-4xl mb-3">📚</div>
              <p className="text-gray-500 mb-4">Aucun module pour l&apos;instant</p>
              {peutCreer && (
                <Link
                  href={"/admin/formations/" + id + "/editeur"}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Ouvrir l&apos;éditeur
                </Link>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {modulesAvecLecons.map((mod, i) => (
                <div key={mod.id} className="p-0">
                  <div className="flex items-center gap-3 px-6 py-4 bg-gray-50">
                    <span className="w-7 h-7 flex items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex-shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-900">{mod.titre}</h3>
                      {mod.description && <p className="text-xs text-gray-500 mt-0.5">{mod.description}</p>}
                    </div>
                    <span className="text-xs text-gray-400">{t('{n} leçon(s)', { n: mod.lecons.length })}</span>
                  </div>
                  {mod.lecons.map((lecon, j) => (
                    <div key={lecon.id} className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 transition-colors border-t border-gray-50">
                      <span className="w-5 h-5 flex items-center justify-center text-xs text-gray-400 font-mono flex-shrink-0">
                        {i + 1}.{j + 1}
                      </span>
                      <span className="text-sm text-gray-700 flex-1">{lecon.titre}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">{t('{n} bloc(s)', { n: lecon.blocs?.length || 0 })}</span>
                      </div>
                    </div>
                  ))}
                  {mod.lecons.length === 0 && (
                    <p className="px-16 py-3 text-xs text-gray-400 italic">{t('Aucune leçon dans ce module')}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Journal des versions */}
        {versions.length > 0 && (
          <details className="mt-6 bg-white rounded-2xl border border-gray-200 overflow-hidden" open>
            <summary className="px-6 py-4 cursor-pointer text-base font-semibold text-gray-900">{t('Journal des versions')} <span className="text-sm font-normal text-gray-400">({versions.length})</span></summary>
            <ul className="divide-y divide-gray-100 border-t border-gray-100">
              {versions.map(v => (
                <li key={v.version} className="px-6 py-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span className="font-semibold text-indigo-700 w-12">v{v.version}</span>
                  <span className="text-gray-500 w-40 shrink-0">{date(v.le)}</span>
                  <span className="text-gray-900 flex-1 min-w-[200px]">{v.note === 'Publication initiale' ? t('Publication initiale') : v.note}</span>
                  <span className="text-gray-500">{v.par}</span>
                </li>
              ))}
            </ul>
          </details>
        )}

        {/* Historique des modifications */}
        {peutCreer && (
          <details className="mt-6 bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <summary className="px-6 py-4 cursor-pointer text-base font-semibold text-gray-900">{t('Historique des modifications')} <span className="text-sm font-normal text-gray-400">({historique.length})</span></summary>
            {historique.length === 0 ? <p className="px-6 pb-5 text-sm text-gray-400">{t('Aucune modification enregistrée pour le moment.')}</p> : (
              <ul className="divide-y divide-gray-100 border-t border-gray-100">
                {historique.map(h => (
                  <li key={h.id} className="px-6 py-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <span className="text-gray-500 w-44 shrink-0">{new Date(h.quand).toLocaleString(loc, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Toronto' })}</span>
                    <span className="text-gray-900 flex-1 min-w-[200px]">{h.quoi}</span>
                    <span className="text-gray-500">{h.qui}</span>
                  </li>
                ))}
              </ul>
            )}
          </details>
        )}
      </div>
    </div>
  )
}
