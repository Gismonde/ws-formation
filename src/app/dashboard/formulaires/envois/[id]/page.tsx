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
  const { data: r } = await serviceClient().from('formulaire_reponses').select('id, numero, statut, soumis_le, definition, reponses, employe_id').eq('id', (await params).id).maybeSingle()
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
      <VueReponses champs={def.champs} reponses={r.reponses ?? {}} avecReserve={false} t={t} />
    </div>
  )
}
