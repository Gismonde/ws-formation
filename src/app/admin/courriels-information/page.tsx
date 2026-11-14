import { redirect } from 'next/navigation'
import { i18n } from '@/lib/i18n/serveur'
import { getActeur, serviceClient, filtrerEmployes } from '@/lib/permissions'
import { FUSEAU } from '@/lib/fuseau'
import { cliniquesPermises, libelleCible, peutEnvoyerInformation, type CourrielInfo } from '@/lib/courriels-information'
import { CLINIQUE_PASSERELLE, type Edition } from '@/lib/passerelle'
import CourrielInfoForm, { AnnulerEnvoi } from './CourrielInfoForm'

export const dynamic = 'force-dynamic'

const STATUTS: Record<string, { libelle: string; classe: string }> = {
  programme: { libelle: 'Programmé', classe: 'bg-blue-50 text-blue-700' },
  envoi: { libelle: 'En cours d’envoi', classe: 'bg-amber-50 text-amber-700' },
  envoye: { libelle: 'Envoyé', classe: 'bg-green-50 text-green-700' },
  annule: { libelle: 'Annulé', classe: 'bg-gray-100 text-gray-500' },
  erreur: { libelle: 'Erreur', classe: 'bg-red-50 text-red-700' },
}

// Administration → Courriel d'information : envoyer (ou programmer) un courriel à tous les employés ou à certains.
export default async function CourrielInformationPage({ searchParams }: { searchParams: Promise<{ passerelle?: string }> }) {
  const { t, loc } = await i18n()
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!peutEnvoyerInformation(acteur)) redirect('/admin')
  const { passerelle } = await searchParams
  const sb = serviceClient()
  const sansVue = { ...acteur, vue: null }
  const [{ data: deps }, { data: postes }, { data: emps }, historique] = await Promise.all([
    sb.from('departements').select('id, nom').order('nom'),
    sb.from('postes').select('nom').order('nom'),
    filtrerEmployes(sb.from('employes').select('id, prenom, nom, poste, clinique').or('actif.is.null,actif.eq.true').order('nom'), sansVue),
    sb.from('courriels_information').select('*').order('cree_le', { ascending: false }).limit(50),
  ])
  const migration = !!historique.error && /courriels_information/.test(historique.error.message)
  const lignes = (historique.data ?? []) as CourrielInfo[]
  const noms = {
    departements: new Map((deps ?? []).map(d => [d.id as string, d.nom as string])),
    employes: new Map((emps ?? []).map(e => [e.id as string, [e.prenom, e.nom].filter(Boolean).join(' ')])),
  }
  const auteurs = new Map<string, string>()
  const idsAuteurs = Array.from(new Set(lignes.map(l => l.cree_par).filter(Boolean) as string[]))
  if (idsAuteurs.length) {
    const { data } = await sb.from('employes').select('id, prenom, nom').in('id', idsAuteurs)
    for (const a of data ?? []) auteurs.set(a.id as string, [a.prenom, a.nom].filter(Boolean).join(' '))
  }

  // Annonce d'une édition de La Passerelle : courriel pré-rempli
  let initial: { objet: string; contenu: string; bouton_libelle: string; bouton_lien: string; cible: { type: 'cliniques'; cliniques: ('WSSC' | 'CMC')[] } } | null = null
  if (passerelle) {
    const { data } = await sb.from('passerelle_editions').select('*').eq('id', passerelle).eq('clinique', CLINIQUE_PASSERELLE).maybeSingle()
    const e = data as Edition | null
    if (e) {
      const date = new Date(e.date_parution + 'T12:00:00').toLocaleDateString('fr-CA', { dateStyle: 'long' })
      initial = {
        objet: `La Passerelle — l’édition ${e.numero} est arrivée !`,
        contenu: [`La nouvelle édition de La Passerelle, le journal de la clinique, est en ligne (${date}).`, e.accroche,
          ...(e.sommaire.length ? ['**Ce qui vous attend dans cette édition :**', ...e.sommaire.map(s => `• ${s.titre}${s.page ? ` (p. ${s.page})` : ''}`)] : []),
          e.temps_lecture ? `Bonne lecture ! Comptez environ ${e.temps_lecture} minutes.` : 'Bonne lecture !'].filter(Boolean).join('\n'),
        bouton_libelle: 'Lire La Passerelle', bouton_lien: '/dashboard/passerelle', cible: { type: 'cliniques', cliniques: ['WSSC'] },
      }
    }
  }
  const date = (d: string) => new Date(d).toLocaleString(loc, { timeZone: FUSEAU, dateStyle: 'medium', timeStyle: 'short' })

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900">{t('Courriel d’information')}</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6 max-w-3xl">{t('Envoyez un courriel à tous les employés, à des départements, à des postes ou à des employés choisis — maintenant ou à une date programmée (lancements, nouvelles, La Passerelle…). Les comptes pas encore activés ne reçoivent rien.')}</p>
      {migration ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{t('Exécutez d’abord')} <code>supabase/migrations/courriels_information.sql</code> {t('dans Supabase.')}</div>
      ) : (
        <>
          <CourrielInfoForm
            initial={initial}
            cliniques={cliniquesPermises(acteur)}
            departements={(deps ?? []).map(d => ({ id: d.id as string, nom: d.nom as string }))}
            postes={Array.from(new Set((postes ?? []).map(p => p.nom as string)))}
            employes={(emps ?? []).map(e => ({ id: e.id as string, nom: [e.prenom, e.nom].filter(Boolean).join(' '), poste: (e.poste as string | null) ?? '' }))}
          />
          <h2 className="text-lg font-bold text-gray-900 mt-10 mb-3">{t('Historique des envois')}</h2>
          {lignes.length === 0 ? <p className="text-sm text-gray-400">{t('Aucun envoi pour l’instant.')}</p> : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead><tr className="bg-gray-50 text-xs uppercase text-gray-500 text-left">
                  <th className="px-4 py-2.5">{t('Objet')}</th><th className="px-3 py-2.5">{t('Destinataires')}</th><th className="px-3 py-2.5">{t('Date')}</th><th className="px-3 py-2.5">{t('Statut')}</th><th className="px-3 py-2.5" />
                </tr></thead>
                <tbody>
                  {lignes.map(l => (
                    <tr key={l.id} className="border-t border-gray-100 align-top">
                      <td className="px-4 py-2.5"><span className="font-medium text-gray-900">{l.objet}</span><span className="block text-xs text-gray-400">{t('Par')} {auteurs.get(l.cree_par ?? '') ?? '—'}</span></td>
                      <td className="px-3 py-2.5 text-gray-600">{t(libelleCible(l.cible, noms))}
                        {l.nb_destinataires !== null && <span className="block text-xs text-gray-400">{t('{n} envoyé(s) sur {total}', { n: l.nb_envoyes ?? 0, total: l.nb_destinataires })}{l.nb_non_actives ? ' · ' + t('{n} compte(s) pas encore activé(s)', { n: l.nb_non_actives }) : ''}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{date(l.envoye_le ?? l.envoi_prevu)}</td>
                      <td className="px-3 py-2.5"><span className={'text-xs font-semibold px-2 py-0.5 rounded-full ' + (STATUTS[l.statut]?.classe ?? '')}>{t(STATUTS[l.statut]?.libelle ?? l.statut)}</span>{l.erreur && <span className="block text-xs text-red-600 mt-1">{l.erreur}</span>}</td>
                      <td className="px-3 py-2.5 text-right">{l.statut === 'programme' && <AnnulerEnvoi id={l.id} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
