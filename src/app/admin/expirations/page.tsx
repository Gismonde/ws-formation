import { i18n } from '@/lib/i18n/serveur'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActeur, serviceClient } from '@/lib/permissions'
import { aAccesAdmin } from '@/lib/cliniques'
import { CliniqueBadge } from '@/components/CliniqueBadge'
import { chargerExpirations, type StatutExpiration } from '@/lib/expirations'

const HORIZONS = [30, 60, 90] as const
const FILTRES: { v: StatutExpiration | 'tous'; l: string }[] = [
  { v: 'tous', l: 'Tous' },
  { v: 'expire', l: 'Expirés' },
  { v: 'bientot', l: 'Expirent bientôt' },
  { v: 'valide', l: 'Valides' },
]

const STYLE_STATUT: Record<StatutExpiration, { classe: string; libelle: string }> = {
  expire: { classe: 'bg-red-100 text-red-700', libelle: 'Expiré' },
  bientot: { classe: 'bg-amber-100 text-amber-800', libelle: 'Expire bientôt' },
  valide: { classe: 'bg-green-100 text-green-700', libelle: 'Valide' },
}

const dateLongueEn = (loc: string) => (iso: string) =>
  new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString(loc, { dateStyle: 'medium' })

function libelleJours(j: number, t: (s: string, v?: Record<string, string | number>) => string): string {
  if (j < 0) return t('Expiré depuis {n} jour(s)', { n: -j })
  if (j === 0) return t("Expire aujourd'hui")
  return t('Dans {n} jour(s)', { n: j })
}

export default async function ExpirationsPage({ searchParams }: { searchParams: Promise<{ statut?: string; horizon?: string }> }) {
  const { t, loc } = await i18n()
  const dateLongue = dateLongueEn(loc)
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!aAccesAdmin(acteur.role)) redirect('/dashboard/accueil')

  const sp = await searchParams
  const horizon = HORIZONS.includes(Number(sp.horizon) as 30) ? Number(sp.horizon) : 60
  const filtre = FILTRES.some(f => f.v === sp.statut) ? (sp.statut as StatutExpiration | 'tous') : 'tous'

  const toutes = await chargerExpirations(serviceClient(), acteur, horizon)
  const lignes = filtre === 'tous' ? toutes : toutes.filter(l => l.statut === filtre)
  const compte = (s: StatutExpiration) => toutes.filter(l => l.statut === s).length
  const lien = (p: { statut?: string; horizon?: number }) => {
    const q = new URLSearchParams({ statut: p.statut ?? filtre, horizon: String(p.horizon ?? horizon) })
    return `/admin/expirations?${q}`
  }
  const exportQ = new URLSearchParams({ statut: filtre, horizon: String(horizon) })

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Expiration des certificats')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Certificats à durée de validité limitée. Les employés reçoivent un rappel automatique par courriel
            60, 30 et 7 jours avant l&apos;expiration, puis le jour même.
          </p>
        </div>
        <div className="flex gap-2">
          <a href={`/api/admin/expirations/export?format=xlsx&${exportQ}`} className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">{t('⬇ Excel')}</a>
          <a href={`/api/admin/expirations/export?format=csv&${exportQ}`} className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">{t('⬇ CSV')}</a>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="text-sm text-gray-500">{t('Expirés')}</div>
          <div className="text-3xl font-bold text-red-700 mt-1">{compte('expire')}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="text-sm text-gray-500">Expirent d&apos;ici {horizon} jours</div>
          <div className="text-3xl font-bold text-amber-700 mt-1">{compte('bientot')}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="text-sm text-gray-500">{t('Valides au-delà de')}{' '}{horizon} jours</div>
          <div className="text-3xl font-bold text-green-700 mt-1">{compte('valide')}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {FILTRES.map(f => (
          <Link key={f.v} href={lien({ statut: f.v })}
            className={'px-3 py-1.5 rounded-full text-sm font-semibold border ' + (f.v === filtre ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200')}>
            {t(f.l)}
          </Link>
        ))}
        <span className="ml-auto text-sm text-gray-500">{t('Horizon :')}</span>
        {HORIZONS.map(h => (
          <Link key={h} href={lien({ horizon: h })}
            className={'px-2.5 py-1 rounded-md text-sm border ' + (h === horizon ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200')}>
            {h} j
          </Link>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="bg-gray-50 text-xs uppercase text-gray-500">
              <th className="text-left px-4 py-3 font-semibold">{t('Employé')}</th>
              <th className="text-left px-3 py-3 font-semibold">{t('Clinique')}</th>
              <th className="text-left px-3 py-3 font-semibold">{t('Formation')}</th>
              <th className="text-left px-3 py-3 font-semibold">{t('Obtenu le')}</th>
              <th className="text-left px-3 py-3 font-semibold">{t('Expire le')}</th>
              <th className="text-left px-3 py-3 font-semibold">{t('Statut')}</th>
            </tr>
          </thead>
          <tbody>
            {lignes.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                {toutes.length === 0
                  ? 'Aucun certificat à durée limitée pour le moment. Indiquez une durée de validité dans une formation pour suivre ses expirations.'
                  : t('Aucun certificat dans ce filtre.')}
              </td></tr>
            )}
            {lignes.map(l => (
              <tr key={l.certificat_id} className="border-t border-gray-100">
                <td className="px-4 py-3">
                  <Link href={`/admin/employes/${l.employe_id}`} className="font-medium text-gray-900 hover:underline">{l.employe_nom}</Link>
                  {l.departement && <div className="text-xs text-gray-400">{l.departement}</div>}
                </td>
                <td className="px-3 py-3"><CliniqueBadge clinique={l.clinique} /></td>
                <td className="px-3 py-3 text-gray-700">{l.formation_titre}</td>
                <td className="px-3 py-3 text-gray-500">{l.date_emission ? dateLongue(l.date_emission) : '—'}</td>
                <td className="px-3 py-3 text-gray-700">{dateLongue(l.date_expiration)}</td>
                <td className="px-3 py-3">
                  <span className={'text-xs font-semibold px-2.5 py-1 rounded-full ' + STYLE_STATUT[l.statut].classe}>{t(STYLE_STATUT[l.statut].libelle)}</span>
                  <div className="text-xs text-gray-400 mt-1">{libelleJours(l.jours_restants, t)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
