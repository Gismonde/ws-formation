import Link from 'next/link'
import { redirect } from 'next/navigation'
import { i18n } from '@/lib/i18n/serveur'
import { getActeur, serviceClient } from '@/lib/permissions'
import { FUSEAU } from '@/lib/fuseau'
import { chargerDestinataires, estStatut, peutVoirPropositions, STATUTS_PROPOSITION, type Proposition, type StatutProposition } from '@/lib/passerelle-propositions'
import CarteProposition from './CarteProposition'

export const dynamic = 'force-dynamic'

const ONGLETS: Record<StatutProposition, string> = { nouvelle: 'Nouvelles', retenue: 'Retenues', classee: 'Classées' }

// La Passerelle → Propositions reçues : réservé aux personnes choisies par un administrateur (et aux administrateurs).
export default async function PropositionsPage({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  const { t, loc } = await i18n()
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  const sb = serviceClient()
  if (!peutVoirPropositions(acteur, await chargerDestinataires(sb))) redirect('/dashboard/passerelle')
  const { statut } = await searchParams
  const filtre: StatutProposition = estStatut(statut) ? statut : 'nouvelle'

  const { data, error } = await sb.from('passerelle_propositions').select('*, auteur:employes!passerelle_propositions_employe_id_fkey(prenom, nom, poste, email)').order('cree_le', { ascending: false }).limit(500)
  const toutes = (data ?? []) as (Proposition & { auteur: { prenom: string | null; nom: string | null; poste: string | null; email: string | null } | null })[]
  const compte = (s: StatutProposition) => toutes.filter(p => p.statut === s).length
  const liste = toutes.filter(p => p.statut === filtre)

  return (
    <div className="max-w-4xl mx-auto">
      <Link href="/dashboard/passerelle" className="text-sm text-gray-500 hover:text-gray-800">← {t('La Passerelle')}</Link>
      <h1 className="text-2xl font-bold text-gray-900 mt-2">{t('Propositions reçues')}</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">{t('Les idées et les photos envoyées par les employés pour La Passerelle. Retenez celles que l’équipe du journal va utiliser et classez les autres.')}</p>
      {error && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 mb-4">{t('Exécutez d’abord')} <code>supabase/migrations/passerelle_propositions.sql</code> {t('dans Supabase.')}</div>}
      <div className="flex flex-wrap gap-2 mb-5">
        {(Object.keys(STATUTS_PROPOSITION) as StatutProposition[]).map(s => (
          <Link key={s} href={`/dashboard/passerelle/propositions?statut=${s}`} className="text-sm font-semibold px-4 py-2 rounded-full border"
            style={filtre === s ? { background: STATUTS_PROPOSITION[s].color, color: '#fff', borderColor: STATUTS_PROPOSITION[s].color } : { background: STATUTS_PROPOSITION[s].bg, color: STATUTS_PROPOSITION[s].color, borderColor: 'transparent' }}>
            {t(ONGLETS[s])} ({compte(s)})
          </Link>
        ))}
      </div>
      {liste.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">{t('Aucune proposition ici.')}</div>
      ) : (
        <div className="space-y-4">
          {liste.map(p => (
            <CarteProposition key={p.id} proposition={{
              id: p.id, sujet: p.sujet, message: p.message, fichiers: p.fichiers ?? [], statut: p.statut, note: p.note ?? '',
              auteur: p.auteur ? [p.auteur.prenom, p.auteur.nom].filter(Boolean).join(' ') : t('Employé retiré'),
              poste: p.auteur?.poste ?? null, email: p.auteur?.email ?? null,
              date: new Date(p.cree_le).toLocaleString(loc, { timeZone: FUSEAU, dateStyle: 'long', timeStyle: 'short' }),
            }} />
          ))}
        </div>
      )}
    </div>
  )
}
