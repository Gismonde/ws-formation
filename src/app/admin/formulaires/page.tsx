import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActeur, serviceClient } from '@/lib/permissions'
import { aAccesAdmin } from '@/lib/cliniques'
import { i18n } from '@/lib/i18n/serveur'
import { peutCreerFormulaires, peutModifierFormulaire, voitTout, numeroReponse, STATUTS, type Formulaire, type StatutReponse } from '@/lib/formulaires'
import { formulairesRecus, tableAbsente, MIGRATION_FORMULAIRES } from '@/lib/formulaires-serveur'
import ActionsFormulaire from '@/components/formulaires/ActionsFormulaire'

export default async function AdminFormulairesPage({ searchParams }: { searchParams: Promise<{ statut?: string; formulaire?: string }> }) {
  const a = await getActeur()
  if (!a || !aAccesAdmin(a)) redirect('/admin')
  const { t, loc } = await i18n()
  const sb = serviceClient()
  const sp = await searchParams
  const { error: absente } = await sb.from('formulaires').select('id', { head: true, count: 'exact' })
  if (absente && tableAbsente(absente)) {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">{t(MIGRATION_FORMULAIRES)}</div>
  }

  const creer = peutCreerFormulaires(a)
  const recus = await formulairesRecus(sb, a)
  const geres = recus.filter(f => peutModifierFormulaire(a, f))
  const ids = recus.map(f => f.id)
  const parId = new Map(recus.map(f => [f.id, f]))

  // Personnes (créateurs, destinataires, déclarants)
  let rq = sb.from('formulaire_reponses').select('*').order('soumis_le', { ascending: false }).limit(200)
  rq = ids.length ? rq.in('formulaire_id', ids) : rq.eq('formulaire_id', '00000000-0000-0000-0000-000000000000')
  if (sp.statut && sp.statut in STATUTS) rq = rq.eq('statut', sp.statut)
  if (sp.formulaire && ids.includes(sp.formulaire)) rq = rq.eq('formulaire_id', sp.formulaire)
  const { data: reponses } = await rq
  const { data: toutes } = ids.length ? await sb.from('formulaire_reponses').select('formulaire_id, statut').in('formulaire_id', ids) : { data: [] }
  const personnesIds = Array.from(new Set([...(reponses ?? []).map(r => r.employe_id), ...recus.flatMap(f => [f.cree_par, f.destinataire_id, ...(f.destinataires ?? []).filter(d => d.type === 'employe').map(d => d.id)])].filter(Boolean) as string[]))
  const { data: pers } = personnesIds.length ? await sb.from('employes').select('id, prenom, nom').in('id', personnesIds) : { data: [] }
  const { data: depts } = await sb.from('departements').select('id, nom')
  const destinatairesTexte = (f: Formulaire) => {
    const l = f.destinataires ?? []
    if (!l.length) return nom(f.destinataire_id ?? f.cree_par)
    return l.map(d => d.type === 'departement' ? `${t('Gestionnaires')} ${(depts ?? []).find(x => x.id === d.id)?.nom ?? ''}` : nom(d.id)).join(', ')
  }
  const admin = recus.some(f => voitTout(a, f))
  const nom = (id: string | null) => { const p = (pers ?? []).find(x => x.id === id); return p ? `${p.prenom ?? ''} ${p.nom ?? ''}`.trim() : '—' }
  const compte = (fid: string, statut?: string) => (toutes ?? []).filter(r => r.formulaire_id === fid && (!statut || r.statut === statut)).length
  const filtre = (p: Record<string, string | undefined>) => '/admin/formulaires?' + new URLSearchParams(Object.entries({ ...sp, ...p }).filter(([, v]) => v) as [string, string][]).toString()

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Formulaires')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('Formulaires du WSSC remplis par les employés (déclarations, demandes). Les réponses sont confidentielles : les administrateurs voient tous les formulaires et leurs statuts ; les gestionnaires et autres destinataires voient seulement ceux qui leur sont assignés.')}</p>
        </div>
        {creer && <Link href="/admin/formulaires/nouveau" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-indigo-700">+ {t('Nouveau formulaire')}</Link>}
      </div>

      {/* Réponses reçues */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-lg font-semibold text-gray-900">📥 {t('Réponses reçues')}</h2>
          <Link href={filtre({ statut: undefined })} className={'rounded-full px-3 py-1 text-xs font-semibold ' + (!sp.statut ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600')}>{t('Toutes')}</Link>
          {admin && (Object.keys(STATUTS) as StatutReponse[]).map(k => (
            <Link key={k} href={filtre({ statut: k })} className="rounded-full px-3 py-1 text-xs font-semibold" style={sp.statut === k ? { background: STATUTS[k].couleur, color: '#fff' } : { background: STATUTS[k].fond, color: STATUTS[k].couleur }}>{t(STATUTS[k].libelle)}</Link>
          ))}
          {sp.formulaire && parId.get(sp.formulaire) && <Link href={filtre({ formulaire: undefined })} className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">{parId.get(sp.formulaire)!.titre} ✕</Link>}
        </div>
        {(reponses ?? []).length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">{t('Aucune réponse pour le moment.')}</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr><th className="px-4 py-2">{t('No')}</th><th className="px-4 py-2">{t('Formulaire')}</th><th className="px-4 py-2">{t('Envoyé par')}</th><th className="px-4 py-2">{t('Date')}</th><th className="px-4 py-2">{t('Section à compléter')}</th>{admin && <th className="px-4 py-2">{t('Statut')}</th>}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(reponses ?? []).map(r => {
                  const s = STATUTS[r.statut as StatutReponse] ?? STATUTS.recu
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-mono text-xs"><Link href={`/admin/formulaires/reponses/${r.id}`} className="text-indigo-700 hover:underline">{numeroReponse(r.numero)}</Link></td>
                      <td className="px-4 py-2.5"><Link href={`/admin/formulaires/reponses/${r.id}`} className="font-medium text-gray-900 hover:underline">{parId.get(r.formulaire_id)?.titre}</Link></td>
                      <td className="px-4 py-2.5 text-gray-700">{r.anonyme ? `🕶️ ${t('Anonyme')}` : nom(r.employe_id)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-gray-500">{new Date(r.soumis_le).toLocaleString(loc, { dateStyle: 'medium', timeStyle: 'short' })}</td>
                      <td className="px-4 py-2.5 text-xs">{r.reserve_complete_le ? <span className="font-semibold text-green-700">✅ {t('Complété')}</span> : <span className="text-amber-700">⏳ {t('À compléter')}</span>}</td>
                      {admin && <td className="px-4 py-2.5">{parId.get(r.formulaire_id) && voitTout(a, parId.get(r.formulaire_id)!) && <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: s.fond, color: s.couleur }}>{t(s.libelle)}</span>}</td>}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Formulaires */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">📝 {t('Formulaires')}</h2>
        {recus.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
            {creer ? t('Aucun formulaire. Créez-en un avec « Nouveau formulaire ».') : t('Aucun formulaire ne vous est adressé.')}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {recus.map((f: Formulaire) => (
              <div key={f.id} className={'rounded-xl border bg-white p-4 shadow-sm ' + (f.archive ? 'border-gray-200 opacity-60' : 'border-gray-200')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900">{f.titre}</div>
                    <div className="text-xs text-gray-500">{[f.code, f.clinique === 'LES_DEUX' ? t('Les deux cliniques') : f.clinique].filter(Boolean).join(' · ')}</div>
                  </div>
                  <span className={'whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ' + (f.archive ? 'bg-gray-100 text-gray-500' : f.actif ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600')}>
                    {f.archive ? t('Archivé') : f.actif ? `🟢 ${t('Publié')}` : t('Brouillon')}
                  </span>
                </div>
                <div className="mt-2 text-xs text-gray-600">📥 {t('Reçu par : {nom}', { nom: destinatairesTexte(f) })} · {t('Créé par : {nom}', { nom: nom(f.cree_par) })}{f.anonyme_permis ? ` · 🕶️ ${t('anonyme possible')}` : ''}</div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <Link href={filtre({ formulaire: f.id, statut: undefined })} className="rounded-lg bg-gray-100 px-3 py-1.5 font-semibold text-gray-700 hover:bg-gray-200">
                    {t('{n} réponse(s)', { n: compte(f.id) })}{compte(f.id, 'recu') ? ` · ${t('{n} nouvelle(s)', { n: compte(f.id, 'recu') })}` : ''}
                  </Link>
                  {peutModifierFormulaire(a, f) && <Link href={`/admin/formulaires/${f.id}`} className="rounded-lg border border-gray-300 px-3 py-1.5 font-semibold text-gray-700 hover:bg-gray-50">✏️ {t('Modifier')}</Link>}
                  {peutModifierFormulaire(a, f) && <ActionsFormulaire id={f.id} actif={f.actif} archive={f.archive} />}
                </div>
              </div>
            ))}
          </div>
        )}
        {!creer && geres.length === 0 && (
          <p className="text-xs text-gray-500">{t('La création de formulaires est réservée aux administrateurs autorisés par l’administrateur global.')}</p>
        )}
      </section>
    </div>
  )
}
