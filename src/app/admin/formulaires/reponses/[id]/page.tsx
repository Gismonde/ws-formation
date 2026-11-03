import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { headers } from 'next/headers'
import { getActeur, serviceClient } from '@/lib/permissions'
import { i18n } from '@/lib/i18n/serveur'
import { peutVoirReponses, voitTout, numeroReponse, STATUTS, type Champ, type Formulaire, type StatutReponse } from '@/lib/formulaires'
import VueReponses from '@/components/formulaires/VueReponses'
import TraitementReponse from '@/components/formulaires/TraitementReponse'
import BoutonImprimer from '@/components/formulaires/BoutonImprimer'

export default async function ReponseFormulairePage({ params }: { params: Promise<{ id: string }> }) {
  const a = await getActeur()
  if (!a) redirect('/login')
  const { t, loc } = await i18n()
  const sb = serviceClient()
  const { data: r } = await sb.from('formulaire_reponses').select('*').eq('id', (await params).id).maybeSingle()
  const { data: f } = r ? await sb.from('formulaires').select('*').eq('id', r.formulaire_id).maybeSingle() : { data: null }
  if (!r || !f || !peutVoirReponses(a, f as Formulaire)) notFound()

  const admin = voitTout(a, f as Formulaire)
  const [{ data: emp }, { data: traitant }, { data: completeur }] = await Promise.all([
    r.employe_id ? sb.from('employes').select('prenom, nom, email, poste').eq('id', r.employe_id).maybeSingle() : Promise.resolve({ data: null }),
    r.traite_par ? sb.from('employes').select('prenom, nom').eq('id', r.traite_par).maybeSingle() : Promise.resolve({ data: null }),
    r.reserve_complete_par ? sb.from('employes').select('prenom, nom').eq('id', r.reserve_complete_par).maybeSingle() : Promise.resolve({ data: null }),
  ])
  const nomDe = (p: { prenom?: string | null; nom?: string | null } | null) => p ? `${p.prenom ?? ''} ${p.nom ?? ''}`.trim() : '—'
  // Journal de consultation (Loi 25 : traçabilité des accès aux renseignements)
  const h = await headers()
  await sb.from('audit_logs').insert({
    acteur_id: a.id, type_action: 'CONSULTATION_DOSSIER', cible_employe_id: r.employe_id,
    description: `Consultation du formulaire « ${(f as Formulaire).titre} » ${numeroReponse(r.numero)}`,
    ip_address: (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || null, user_agent: h.get('user-agent'),
    metadata: { page: '/admin/formulaires/reponses/' + r.id, reponse_id: r.id },
  })

  const def = r.definition as { titre: string; code?: string | null; champs: Champ[] }
  const s = STATUTS[r.statut as StatutReponse] ?? STATUTS.recu
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="print:hidden"><Link href="/admin/formulaires" className="text-sm text-gray-500 hover:text-gray-800">← {t('Formulaires')}</Link></div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{def.code ?? ''}</p>
          <h1 className="text-2xl font-bold text-gray-900">{def.titre} <span className="font-mono text-lg text-gray-500">{numeroReponse(r.numero)}</span></h1>
          <p className="mt-1 text-sm text-gray-600">
            {r.anonyme ? `🕶️ ${t('Envoyé de façon anonyme')}` : <>{t('Envoyé par {nom}', { nom: nomDe(emp) })}{emp?.poste ? ` (${emp.poste})` : ''}</>}
            {' · '}{new Date(r.soumis_le).toLocaleString(loc, { dateStyle: 'long', timeStyle: 'short' })}
          </p>
          {admin && traitant && <p className="text-xs text-gray-500">{t('Dernier traitement : {nom}', { nom: `${traitant.prenom ?? ''} ${traitant.nom ?? ''}`.trim() })}{r.traite_le ? ` · ${new Date(r.traite_le).toLocaleDateString(loc, { dateStyle: 'medium' })}` : ''}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {r.reserve_complete_le && <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">✅ {t('Complété par {nom} le {date}', { nom: nomDe(completeur), date: new Date(r.reserve_complete_le).toLocaleDateString(loc, { dateStyle: 'medium' }) })}</span>}
          {admin && <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: s.fond, color: s.couleur }}>{t(s.libelle)}</span>}
          <BoutonImprimer />
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          <VueReponses champs={def.champs} reponses={r.reponses ?? {}} reserve={r.reserve ?? {}} avecReserve t={t} />
          {admin && r.note_interne && <div className="hidden whitespace-pre-wrap rounded-xl border border-gray-200 p-4 text-sm print:block"><strong>{t('Note interne')} :</strong> {r.note_interne}</div>}
        </div>
        <TraitementReponse reponseId={r.id} champs={def.champs} statut={r.statut} reserve={r.reserve ?? {}} note={r.note_interne}
          admin={admin} complete={!!r.reserve_complete_le} anonyme={r.anonyme === true || !r.employe_id} reponseEmploye={r.reponse_employe ?? null} />
      </div>
    </div>
  )
}
