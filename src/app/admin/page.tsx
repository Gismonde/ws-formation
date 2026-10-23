// Tableau de bord de l'administration : ce qui demande une action, dans le périmètre de la personne connectée.
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActeur, serviceClient, cliniquesContenuVisibles } from '@/lib/permissions'
import { aAccesAdmin } from '@/lib/cliniques'
import { chargerConformite, synthese } from '@/lib/conformite'
import { chargerExpirations } from '@/lib/expirations'
import { employesDansPortee, statistiquesPolitiques, peutSuivrePolitique, type Politique } from '@/lib/politiques'
import { avancementJournees, CHAMPS_JOURNEE, type Journee } from '@/lib/journees'
import { i18n } from '@/lib/i18n/serveur'

const carte = 'bg-white rounded-2xl border border-gray-200 p-5'
const MAX = 6

export default async function TableauDeBord() {
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!aAccesAdmin(acteur)) redirect('/dashboard/accueil')
  const { t, loc } = await i18n()
  const sb = serviceClient()
  const jour = (d: string | null) => (d ? new Date(d.length === 10 ? d + 'T12:00:00' : d).toLocaleDateString(loc, { dateStyle: 'medium' }) : '—')

  const [conformite, expirations, { data: pols }, portee, { data: journeesBrutes }] = await Promise.all([
    chargerConformite(sb, acteur),
    chargerExpirations(sb, acteur, 60),
    sb.from('politiques').select('*').eq('actif', true),
    employesDansPortee(sb, acteur),
    sb.from('journees_formation').select(CHAMPS_JOURNEE).eq('modele', false).in('clinique', cliniquesContenuVisibles(acteur)).order('cree_le', { ascending: false }).limit(50),
  ])
  const s = synthese(conformite)

  // Validation des formations : à valider par moi, et mes demandes qui attendent une action
  const [{ data: aValider }, { data: mesDemandes }] = await Promise.all([
    sb.from('formations').select('id, titre, validation_demandee_le, copie_de').eq('validateur_id', acteur.id).eq('statut_validation', 'en_validation').order('validation_demandee_le'),
    sb.from('formations').select('id, titre, statut_validation, publiee, copie_de').eq('validation_demandee_par', acteur.id).in('statut_validation', ['en_validation', 'a_modifier', 'approuvee']),
  ])
  const demandes = (mesDemandes ?? []).filter(f => !(f.statut_validation === 'approuvee' && f.publiee))

  // Formations en retard
  const retards = conformite.flatMap(e => e.assignations.filter(a => a.en_retard).map(a => ({ e, a })))
    .sort((x, y) => (x.a.date_echeance ?? '').localeCompare(y.a.date_echeance ?? ''))

  // Certificats expirés ou qui expirent dans 60 jours
  const aRenouveler = expirations.filter(l => l.statut !== 'valide')

  // Politiques : confirmations en attente
  const politiques = ((pols ?? []) as Politique[]).filter(p => peutSuivrePolitique(acteur, p))
  const stats = await statistiquesPolitiques(sb, politiques, portee)
  const enAttente = politiques.map(p => ({ p, st: stats[p.id] })).filter(x => x.st && x.st.total > x.st.confirmes)
    .sort((a, b) => (b.st.total - b.st.confirmes) - (a.st.total - a.st.confirmes))
  const confirmationsManquantes = enAttente.reduce((n, x) => n + x.st.total - x.st.confirmes, 0)

  // Journées de formation en cours (au moins un employé n'a pas tout terminé)
  const journees = (journeesBrutes ?? []) as Journee[]
  const avancement = journees.length ? await avancementJournees(sb, journees) : {}
  const enCours = journees.map(j => {
    const suivi = avancement[j.id] ?? []
    return { j, finis: suivi.filter(x => x.total > 0 && x.faits === x.total).length, total: suivi.length }
  }).filter(x => x.total > 0 && x.finis < x.total)

  const indicateurs = [
    { v: s.taux + ' %', l: t('Taux de complétion'), href: '/admin/conformite', couleur: '#4338ca' },
    { v: retards.length, l: t('Formations en retard'), href: '/admin/conformite', couleur: retards.length ? '#dc2626' : '#16a34a' },
    { v: aRenouveler.length, l: t('Certificats à renouveler (60 jours)'), href: '/admin/expirations', couleur: aRenouveler.length ? '#d97706' : '#16a34a' },
    { v: confirmationsManquantes, l: t('Confirmations de politiques en attente'), href: '/admin/politiques', couleur: confirmationsManquantes ? '#d97706' : '#16a34a' },
    { v: enCours.length, l: t('Journées de formation en cours'), href: '/admin/journees', couleur: '#0369a1' },
    ...((aValider ?? []).length || demandes.length ? [{ v: (aValider ?? []).length, l: t('Formations à valider'), href: '/admin/formations/a-valider', couleur: (aValider ?? []).length ? '#7c3aed' : '#16a34a' }] : []),
  ]

  const Vide = ({ texte }: { texte: string }) => <p className="text-sm text-gray-400 py-3">✓ {texte}</p>
  const Titre = ({ titre, href, n }: { titre: string; href: string; n: number }) => (
    <div className="flex items-center justify-between mb-3">
      <h2 className="font-semibold text-gray-900">{titre} {n > 0 && <span className="text-sm font-normal text-gray-400">({n})</span>}</h2>
      <Link href={href} className="text-sm font-medium text-indigo-600 hover:underline">{t('Tout voir →')}</Link>
    </div>
  )

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold text-gray-900">{t('Tableau de bord')}</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">{t('Ce qui demande votre attention, dans votre périmètre ({n} employé(s) actif(s)).', { n: s.employes })}</p>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6 mb-6">
        {indicateurs.map(k => (
          <Link key={k.l} href={k.href} className={carte + ' hover:shadow-sm transition-shadow'}>
            <div className="text-2xl font-bold" style={{ color: k.couleur }}>{k.v}</div>
            <div className="text-xs text-gray-500 mt-1">{k.l}</div>
          </Link>
        ))}
      </div>

      {((aValider ?? []).length > 0 || demandes.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2 mb-4">
          <section className={carte}>
            <Titre titre={t('Formations à valider')} href="/admin/formations/a-valider" n={(aValider ?? []).length} />
            {(aValider ?? []).length === 0 ? <Vide texte={t('Aucune formation en attente de votre validation.')} /> : (
              <ul className="divide-y divide-gray-100 text-sm">
                {(aValider ?? []).slice(0, MAX).map(f => (
                  <li key={f.id} className="py-2 flex justify-between gap-3">
                    <Link href={`/admin/formations/${f.id}`} className="font-medium text-gray-900 truncate hover:text-indigo-700">{f.titre}{f.copie_de ? ' — ' + t('copie de travail') : ''}</Link>
                    <span className="text-xs text-violet-700 whitespace-nowrap">{t('Depuis le {date}', { date: jour(f.validation_demandee_le) })}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className={carte}>
            <Titre titre={t('En attente de validation')} href="/admin/formations/a-valider" n={demandes.length} />
            {demandes.length === 0 ? <Vide texte={t('Aucune demande en cours.')} /> : (
              <ul className="divide-y divide-gray-100 text-sm">
                {demandes.slice(0, MAX).map(f => (
                  <li key={f.id} className="py-2 flex justify-between gap-3">
                    <Link href={`/admin/formations/${f.id}`} className="font-medium text-gray-900 truncate hover:text-indigo-700">{f.titre}{f.copie_de ? ' — ' + t('copie de travail') : ''}</Link>
                    <span className={'text-xs whitespace-nowrap ' + (f.statut_validation === 'approuvee' ? 'text-green-700' : f.statut_validation === 'a_modifier' ? 'text-red-600' : 'text-amber-700')}>
                      {f.statut_validation === 'approuvee' ? t('Approuvée — à publier') : f.statut_validation === 'a_modifier' ? t('Modifications demandées') : t('En attente')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={carte}>
          <Titre titre={t('Formations en retard')} href="/admin/conformite" n={retards.length} />
          {retards.length === 0 ? <Vide texte={t('Aucune formation en retard.')} /> : (
            <ul className="divide-y divide-gray-100 text-sm">
              {retards.slice(0, MAX).map(({ e, a }) => (
                <li key={e.id + a.formation_id} className="py-2 flex justify-between gap-3">
                  <Link href={`/admin/employes/${e.id}?onglet=formations`} className="min-w-0"><span className="font-medium text-gray-900">{e.prenom} {e.nom}</span><span className="block text-xs text-gray-500 truncate">{a.formation_titre}</span></Link>
                  <span className="text-xs text-red-600 whitespace-nowrap">{t('Échéance')} {jour(a.date_echeance)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={carte}>
          <Titre titre={t('Certificats à renouveler')} href="/admin/expirations" n={aRenouveler.length} />
          {aRenouveler.length === 0 ? <Vide texte={t('Aucun certificat n’expire dans les 60 prochains jours.')} /> : (
            <ul className="divide-y divide-gray-100 text-sm">
              {aRenouveler.slice(0, MAX).map(l => (
                <li key={l.certificat_id} className="py-2 flex justify-between gap-3">
                  <Link href={`/admin/employes/${l.employe_id}?onglet=certificats`} className="min-w-0"><span className="font-medium text-gray-900">{l.employe_nom}</span><span className="block text-xs text-gray-500 truncate">{l.formation_titre}</span></Link>
                  <span className={'text-xs whitespace-nowrap ' + (l.statut === 'expire' ? 'text-red-600' : 'text-amber-700')}>
                    {l.statut === 'expire' ? t('Expiré le {date}', { date: jour(l.date_expiration) }) : t('Expire le {date}', { date: jour(l.date_expiration) })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={carte}>
          <Titre titre={t('Politiques non confirmées')} href="/admin/politiques" n={enAttente.length} />
          {enAttente.length === 0 ? <Vide texte={t('Toutes les politiques sont confirmées.')} /> : (
            <ul className="divide-y divide-gray-100 text-sm">
              {enAttente.slice(0, MAX).map(({ p, st }) => (
                <li key={p.id} className="py-2">
                  <Link href={`/admin/politiques/${p.id}`} className="flex justify-between gap-3">
                    <span className="font-medium text-gray-900 truncate">{p.titre}</span>
                    <span className="text-xs text-gray-500 whitespace-nowrap">{t('{n} en attente', { n: st.total - st.confirmes })} · {st.pourcentage} %</span>
                  </Link>
                  <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-amber-500" style={{ width: `${st.pourcentage}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={carte}>
          <Titre titre={t('Journées de formation en cours')} href="/admin/journees" n={enCours.length} />
          {enCours.length === 0 ? <Vide texte={t('Aucune journée de formation en cours.')} /> : (
            <ul className="divide-y divide-gray-100 text-sm">
              {enCours.slice(0, MAX).map(({ j, finis, total }) => (
                <li key={j.id} className="py-2">
                  <div className="flex justify-between gap-3">
                    <span className="min-w-0"><span className="font-medium text-gray-900">{j.nom}</span><span className="block text-xs text-gray-500">{j.raison}{j.date_echeance ? ' · ' + t('À compléter avant le {date}', { date: jour(j.date_echeance) }) : ''}</span></span>
                    <span className="text-xs text-gray-500 whitespace-nowrap">{t('{f}/{n} ont terminé', { f: finis, n: total })}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-sky-600" style={{ width: `${Math.round((finis / total) * 100)}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
