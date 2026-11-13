import { i18n } from '@/lib/i18n/serveur'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getActeur, serviceClient, filtrerEmployes } from '@/lib/permissions'
import { aAccesAdmin } from '@/lib/cliniques'
import { CliniqueBadge } from '@/components/CliniqueBadge'
import { FUSEAU } from '@/lib/fuseau'
import { etatAcces, dernieresConnexions, logsInvitations, liensUtilises, connexionsDuJournal, type EtatAcces, type LogInvitation } from '@/lib/acces-employes'

export const dynamic = 'force-dynamic'

const STYLES: Record<EtatAcces, { icone: string; libelle: string; bg: string; color: string; border: string }> = {
  active: { icone: '✅', libelle: 'Activé', bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  invite: { icone: '⏳', libelle: 'Invité, pas encore activé', bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
  jamais: { icone: '⚪', libelle: 'Jamais invité', bg: '#f9fafb', color: '#4b5563', border: '#e5e7eb' },
}
const ORDRE: EtatAcces[] = ['jamais', 'invite', 'active']

export default async function AccesEmployesPage({ searchParams }: { searchParams: Promise<{ etat?: string }> }) {
  const { t, loc } = await i18n()
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!aAccesAdmin(acteur)) redirect('/dashboard/accueil')
  const { etat: filtre } = await searchParams
  const filtreEtat = ORDRE.includes(filtre as EtatAcces) ? (filtre as EtatAcces) : null

  const sb = serviceClient()
  const { data: employes } = await filtrerEmployes(sb.from('employes').select('id, prenom, nom, email, poste, role, clinique, auth_user_id, departements(nom)').eq('actif', true).order('nom'), acteur)
  const liste = (employes ?? []) as unknown as { id: string; prenom: string | null; nom: string | null; email: string | null; poste: string | null; role: string; clinique: string | null; auth_user_id: string | null; departements: { nom: string } | null }[]

  const authIds = liste.map(e => e.auth_user_id).filter((x): x is string => !!x)
  const [connexions, logs, liens, journal] = await Promise.all([
    dernieresConnexions(sb, authIds), logsInvitations(sb, liste.map(e => e.id)), liensUtilises(sb, authIds), connexionsDuJournal(sb, liste.map(e => e.id)),
  ])
  const parEmploye = new Map<string, LogInvitation[]>()
  for (const l of logs) if (l.cible_employe_id) parEmploye.set(l.cible_employe_id, [...(parEmploye.get(l.cible_employe_id) ?? []), l])

  const lignes = liste.map(e => ({
    e,
    acces: etatAcces({
      derniereConnexion: e.auth_user_id ? connexions.get(e.auth_user_id) ?? null : null,
      logs: parEmploye.get(e.id) ?? [],
      lienUtiliseLe: e.auth_user_id ? liens.get(e.auth_user_id) ?? null : null,
      connexionsJournal: journal.get(e.id) ?? null,
    }),
  }))
  const compte = (x: EtatAcces) => lignes.filter(l => l.acces.etat === x).length
  const affichees = lignes
    .filter(l => !filtreEtat || l.acces.etat === filtreEtat)
    .sort((a, b) => ORDRE.indexOf(a.acces.etat) - ORDRE.indexOf(b.acces.etat) || `${a.e.nom} ${a.e.prenom}`.localeCompare(`${b.e.nom} ${b.e.prenom}`, 'fr'))
  const date = (d: string | null) => d ? new Date(d).toLocaleDateString(loc, { timeZone: FUSEAU, day: 'numeric', month: 'short', year: 'numeric' }) : ''

  return (
    <div className="max-w-6xl">
      <Link href="/admin/employes" className="text-sm text-gray-500 hover:text-gray-800">{t('← Employés')}</Link>
      <h1 className="text-2xl font-bold text-gray-900 mt-2">{t('Accès des employés')}</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6 max-w-3xl">
        {t('Qui a créé son accès au portail, qui a reçu le courriel d’activation sans l’avoir encore utilisé, et qui ne l’a jamais reçu. Employés actifs seulement. Pour envoyer ou renvoyer le courriel, ouvrez la fiche de l’employé : « Renvoyer l’invitation ».')}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
        <Link href="/admin/employes/acces" className={`rounded-xl border p-4 bg-white hover:border-gray-400 ${!filtreEtat ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-200'}`}>
          <div className="text-xs uppercase text-gray-500 font-semibold">{t('Tous')}</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{lignes.length}</div>
        </Link>
        {(['active', 'invite', 'jamais'] as EtatAcces[]).map(x => (
          <Link key={x} href={`/admin/employes/acces?etat=${x}`} className="rounded-xl border p-4 hover:opacity-90"
            style={{ background: STYLES[x].bg, borderColor: filtreEtat === x ? STYLES[x].color : STYLES[x].border, boxShadow: filtreEtat === x ? `0 0 0 1px ${STYLES[x].color}` : undefined }}>
            <div className="text-xs uppercase font-semibold" style={{ color: STYLES[x].color }}>{STYLES[x].icone} {t(STYLES[x].libelle)}</div>
            <div className="text-2xl font-bold mt-1" style={{ color: STYLES[x].color }}>{compte(x)}</div>
          </Link>
        ))}
      </div>

      {affichees.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">{t('Aucun employé.')}</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase text-gray-500 text-left">
                <th className="px-4 py-2.5 font-semibold">{t('Nom')}</th>
                <th className="px-3 py-2.5 font-semibold">{t('Courriel')}</th>
                <th className="px-3 py-2.5 font-semibold">{t('Clinique')}</th>
                <th className="px-3 py-2.5 font-semibold">{t('Département')}</th>
                <th className="px-3 py-2.5 font-semibold">{t('Accès')}</th>
              </tr>
            </thead>
            <tbody>
              {affichees.map(({ e, acces }) => {
                const s = STYLES[acces.etat]
                return (
                  <tr key={e.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/employes/${e.id}`} className="font-medium text-gray-900 hover:underline">{[e.prenom, e.nom].filter(Boolean).join(' ') || '—'}</Link>
                      {e.poste && <div className="text-xs text-gray-500">{e.poste}</div>}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">{e.email}</td>
                    <td className="px-3 py-2.5"><CliniqueBadge clinique={e.clinique} role={e.role} /></td>
                    <td className="px-3 py-2.5 text-gray-600">{e.departements?.nom ?? <span className="text-gray-400 italic">{t('Non assigné')}</span>}</td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap" style={{ background: s.bg, color: s.color, borderColor: s.border }}>
                        {s.icone} {acces.etat === 'active' ? t('Activé le {date}', { date: date(acces.date) })
                          : acces.etat === 'invite' ? t('Invité le {date}, pas encore activé', { date: date(acces.date) })
                          : t('Jamais invité')}
                      </span>
                      {acces.etat === 'active' && (
                        <div className="text-xs text-gray-400 mt-1">{acces.derniereConnexion ? t('Dernière connexion : {date}', { date: date(acces.derniereConnexion) }) : t('Mot de passe choisi, pas encore connecté')}</div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
