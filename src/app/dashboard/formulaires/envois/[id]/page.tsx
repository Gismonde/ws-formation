import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getActeur, serviceClient } from '@/lib/permissions'
import { i18n } from '@/lib/i18n/serveur'
import { numeroReponse, STATUTS, type Champ, type StatutReponse } from '@/lib/formulaires'
import VueReponses from '@/components/formulaires/VueReponses'
import BoutonImprimer from '@/components/formulaires/BoutonImprimer'

/** L'employé revoit son propre envoi (sans les sections réservées ni la note interne). */
export default async function MonEnvoiPage({ params }: { params: Promise<{ id: string }> }) {
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  const { t, loc } = await i18n()
  const { data: r } = await serviceClient().from('formulaire_reponses').select('*').eq('id', (await params).id).maybeSingle()
  if (!r || r.employe_id !== acteur.id) notFound()
  const def = r.definition as { titre: string; code?: string | null; champs: Champ[] }
  const s = STATUTS[r.statut as StatutReponse] ?? STATUTS.recu
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="print:hidden"><Link href="/dashboard/formulaires" className="text-sm text-gray-500 hover:text-gray-800">← {t('Formulaires')}</Link></div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{def.titre}</h1>
          <p className="text-sm text-gray-500">{numeroReponse(r.numero)} · {t('Envoyé le {date}', { date: new Date(r.soumis_le).toLocaleString(loc, { dateStyle: 'long', timeStyle: 'short' }) })}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: s.fond, color: s.couleur }}>{t(s.libelle)}</span>
          <BoutonImprimer />
        </div>
      </div>
      {/* Suivi : étapes du traitement */}
      <ol className="flex flex-wrap items-center gap-2 text-xs print:hidden" aria-label={t('Suivi du traitement')}>
        {(['recu', 'en_traitement', 'traite'] as StatutReponse[]).map((k, i, l) => {
          const atteint = l.indexOf(r.statut as StatutReponse) >= i
          return (
            <li key={k} className="flex items-center gap-2">
              <span className="rounded-full px-3 py-1 font-semibold" style={atteint ? { background: STATUTS[k].fond, color: STATUTS[k].couleur } : { background: '#f3f4f6', color: '#9ca3af' }}>{atteint ? '● ' : '○ '}{t(STATUTS[k].libelle)}</span>
              {i < l.length - 1 && <span className="text-gray-300">→</span>}
            </li>
          )
        })}
        {r.statut_le && <li className="text-gray-500">{t('Mis à jour le {date}', { date: new Date(r.statut_le).toLocaleString(loc, { dateStyle: 'medium', timeStyle: 'short' }) })}</li>}
      </ol>
      {r.reponse_employe && (
        <section className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <h2 className="text-sm font-bold text-indigo-900">💬 {t('Réponse de la personne responsable')}</h2>
          {r.reponse_le && <p className="text-xs text-indigo-700">{new Date(r.reponse_le).toLocaleString(loc, { dateStyle: 'long', timeStyle: 'short' })}</p>}
          <p className="mt-2 whitespace-pre-wrap text-sm text-indigo-950">{r.reponse_employe}</p>
        </section>
      )}
      <VueReponses champs={def.champs} reponses={r.reponses ?? {}} avecReserve={false} t={t} />
    </div>
  )
}
