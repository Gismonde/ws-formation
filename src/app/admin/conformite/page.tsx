import { i18n } from '@/lib/i18n/serveur'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActeur, serviceClient, departementsVisibles, cliniquesAdministrees } from '@/lib/permissions'
import { aAccesAdmin, CLINIQUE_INFO, type Clinique } from '@/lib/cliniques'
import { CliniqueBadge } from '@/components/CliniqueBadge'
import { chargerConformite, synthese } from '@/lib/conformite'
import { LIBELLE_STATUT, estComplete, type StatutFormation } from '@/lib/etat-formations'

const STYLE_STATUT: Record<StatutFormation, { bg: string; color: string }> = {
  non_commence: { bg: '#f3f4f6', color: '#6b7280' },
  en_cours: { bg: '#fef3c7', color: '#92400e' },
  termine: { bg: '#d1fae5', color: '#065f46' },
  certifie: { bg: '#e0e7ff', color: '#4338ca' },
}

const date = (iso: string | null) =>
  iso ? new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('fr-CA', { dateStyle: 'medium' }) : null

type Params = { clinique?: string; departement?: string; vue?: string }

export default async function ConformitePage({ searchParams }: { searchParams: Promise<Params> }) {
  const { t } = await i18n()
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!aAccesAdmin(acteur.role)) redirect('/dashboard/accueil')
  const sb = serviceClient()
  const sp = await searchParams

  const cliniquesPossibles: Clinique[] = acteur.role === 'gestionnaire' ? [] : cliniquesAdministrees(acteur)
  const clinique = cliniquesPossibles.includes(sp.clinique as Clinique) ? (sp.clinique as Clinique) : null
  const departements = await departementsVisibles(acteur, sb)
  const departement = departements.some(d => d.id === sp.departement) ? sp.departement! : null
  const vue = sp.vue === 'retard' || sp.vue === 'incomplet' ? sp.vue : 'tous'

  const toutes = await chargerConformite(sb, acteur, { clinique, departement_id: departement })
  const data = toutes
    .map(e => ({
      ...e,
      assignations: vue === 'retard' ? e.assignations.filter(a => a.en_retard)
        : vue === 'incomplet' ? e.assignations.filter(a => !estComplete(a.statut)) : e.assignations,
    }))
    .filter(e => vue === 'tous' || e.assignations.length > 0)
  const s = synthese(toutes)

  const filtresQ = new URLSearchParams()
  if (clinique) filtresQ.set('clinique', clinique)
  if (departement) filtresQ.set('departement', departement)
  if (vue !== 'tous') filtresQ.set('vue', vue)
  const lienVue = (v: string) => {
    const q = new URLSearchParams(filtresQ)
    if (v === 'tous') q.delete('vue'); else q.set('vue', v)
    return `/admin/conformite${q.size ? '?' + q : ''}`
  }
  const exporter = (format: string) => `/api/admin/conformite/export?format=${format}${filtresQ.size ? '&' + filtresQ : ''}`

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1f36', margin: 0 }}>{t('Conformité')}</h1>
          <p style={{ color: '#6b7280', marginTop: '4px', fontSize: '14px' }}>
            Suivi de la conformité réglementaire — {s.employes} employé(s) actif(s)
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[['xlsx', 'Excel'], ['pdf', 'PDF'], ['csv', 'CSV']].map(([f, l]) => (
            <a key={f} href={exporter(f)} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>⬇ {l}</a>
          ))}
        </div>
      </div>

      <form method="get" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end', marginBottom: '20px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '14px 16px' }}>
        {cliniquesPossibles.length > 1 && (
          <label style={{ fontSize: '12px', color: '#6b7280', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {t('Clinique')}
            <select name="clinique" defaultValue={clinique ?? ''} style={{ padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', background: '#fff' }}>
              <option value="">{t('Toutes')}</option>
              {cliniquesPossibles.map(c => <option key={c} value={c}>{CLINIQUE_INFO[c].nom}</option>)}
            </select>
          </label>
        )}
        {departements.length > 1 && (
          <label style={{ fontSize: '12px', color: '#6b7280', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {t('Département')}
            <select name="departement" defaultValue={departement ?? ''} style={{ padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', background: '#fff' }}>
              <option value="">{t('Tous')}</option>
              {departements.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}
            </select>
          </label>
        )}
        {vue !== 'tous' && <input type="hidden" name="vue" value={vue} />}
        {(cliniquesPossibles.length > 1 || departements.length > 1) && (
          <button type="submit" style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#111827', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>{t('Filtrer')}</button>
        )}
        <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto', flexWrap: 'wrap' }}>
          {[['tous', t('Toutes les formations')], ['incomplet', t('À compléter')], ['retard', `En retard (${s.en_retard})`]].map(([v, l]) => (
            <Link key={v} href={lienVue(v)} style={{
              padding: '6px 12px', borderRadius: '999px', fontSize: '13px', fontWeight: 600, textDecoration: 'none', border: '1px solid #e5e7eb',
              background: vue === v ? '#111827' : '#fff', color: vue === v ? '#fff' : (v === 'retard' && s.en_retard ? '#b91c1c' : '#374151'),
            }}>{l}</Link>
          ))}
        </div>
      </form>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '28px' }}>
        {[
          { label: t('Taux de conformité'), value: s.taux + ' %', color: s.taux >= 80 ? '#065f46' : s.taux >= 50 ? '#92400e' : '#991b1b' },
          { label: t('Formations assignées'), value: String(s.assignations), color: '#1a1f36' },
          { label: t('Terminées ou certifiées'), value: String(s.completes), color: '#065f46' },
          { label: 'En retard', value: String(s.en_retard), color: s.en_retard ? '#b91c1c' : '#065f46' },
          { label: 'Certificats valides', value: String(s.certificats), color: '#4338ca' },
          { label: t('Attestations « lu et compris »'), value: s.attestations_requises ? `${s.attestations_signees}/${s.attestations_requises}` : '—', color: s.attestations_requises && s.attestations_signees === s.attestations_requises ? '#065f46' : '#92400e' },
        ].map(stat => (
          <div key={stat.label} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '16px 18px' }}>
            <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>{t(stat.label)}</p>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {data.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
            {vue === 'retard' ? t('Aucune formation en retard.') : vue === 'incomplet' ? t('Toutes les formations assignées sont complétées.') : t('Aucun employé actif trouvé.')}
          </div>
        ) : data.map(emp => {
          const faits = emp.assignations.filter(a => estComplete(a.statut)).length
          const total = emp.assignations.length
          const taux = total > 0 ? Math.round((faits / total) * 100) : 0
          const retards = emp.assignations.filter(a => a.en_retard).length
          const couleur = taux >= 80 ? '#065f46' : taux >= 50 ? '#92400e' : '#6b7280'

          return (
            <details key={emp.id} open={vue !== 'tous' && data.length <= 5} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              <summary style={{ padding: '14px 18px', cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', minWidth: 0 }}>
                  <div style={{ minWidth: '180px' }}>
                    <div style={{ fontWeight: 700, color: '#1a1f36', fontSize: '14px' }}>{emp.prenom} {emp.nom}</div>
                    <div style={{ fontSize: '12px', color: '#9ca3af' }}>{emp.email}</div>
                  </div>
                  <CliniqueBadge clinique={emp.clinique} />
                  {emp.departement && (
                    <span style={{ fontSize: '12px', color: '#6b7280', background: '#f3f4f6', padding: '2px 10px', borderRadius: '20px', whiteSpace: 'nowrap' }}>{emp.departement}</span>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ background: '#e5e7eb', borderRadius: '4px', height: '8px', width: '80px' }}>
                      <div style={{ width: taux + '%', background: taux >= 80 ? '#10b981' : taux >= 50 ? '#f59e0b' : '#9ca3af', height: '8px', borderRadius: '4px' }} />
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: couleur }}>{taux} %</span>
                  </div>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>{faits}/{total} formations</span>
                  {retards > 0 && (
                    <span style={{ fontSize: '12px', color: '#b91c1c', background: '#fee2e2', padding: '1px 8px', borderRadius: '20px', fontWeight: 600 }}>{retards}{' '}{t('en retard')}</span>
                  )}
                </div>
                <span style={{ color: '#9ca3af', fontSize: '14px', flexShrink: 0 }}>&#9660;</span>
              </summary>
              <div style={{ padding: '8px 18px', borderTop: '1px solid #f3f4f6', background: '#f9fafb', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <a href={`/api/admin/conformite/export?format=pdf&employe=${emp.id}`} style={{ padding: '5px 12px', borderRadius: '6px', background: '#fff', color: '#374151', textDecoration: 'none', fontSize: '12px', fontWeight: 600, border: '1px solid #e5e7eb' }}>{t('⬇ Fiche PDF')}</a>
                <Link href={'/admin/employes/' + emp.id} style={{ padding: '5px 12px', borderRadius: '6px', background: '#eff6ff', color: '#2563eb', textDecoration: 'none', fontSize: '12px', fontWeight: 600, border: '1px solid #bfdbfe' }}>{t('Voir le dossier')}</Link>
              </div>
              <div style={{ borderTop: '1px solid #f3f4f6', overflowX: 'auto' }}>
                {emp.assignations.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>{t('Aucune formation assignée.')}</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '760px' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        {['Formation', 'Échéance', 'Statut', 'Progression', 'Leçons', t('Lu et compris'), 'Certificat'].map((t, i) => (
                          <th key={t} style={{ padding: '10px 14px', textAlign: i === 0 || i === 3 ? 'left' : 'center', fontWeight: 600, color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #f3f4f6' }}>{t}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {emp.assignations.map((a, i) => {
                        const sc = STYLE_STATUT[a.statut]
                        return (
                          <tr key={a.formation_id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                            <td style={{ padding: '11px 14px', fontWeight: 500, color: '#1a1f36' }}>
                              {a.formation_titre}
                              {a.obligatoire && <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: 700, color: '#dc2626' }}>{t('LSST')}</span>}
                            </td>
                            <td style={{ padding: '11px 14px', textAlign: 'center', whiteSpace: 'nowrap', color: a.en_retard ? '#b91c1c' : '#6b7280', fontWeight: a.en_retard ? 700 : 400 }}>
                              {date(a.date_echeance) ?? '—'}{a.en_retard && <div style={{ fontSize: '10px' }}>{t('En retard')}</div>}
                            </td>
                            <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                              <span style={{ background: sc.bg, color: sc.color, padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}>{t(LIBELLE_STATUT[a.statut])}</span>
                            </td>
                            <td style={{ padding: '11px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ flex: 1, background: '#e5e7eb', borderRadius: '4px', height: '6px', minWidth: '70px' }}>
                                  <div style={{ width: a.progression + '%', background: estComplete(a.statut) ? '#10b981' : '#6366f1', height: '6px', borderRadius: '4px' }} />
                                </div>
                                <span style={{ fontSize: '11px', color: '#6b7280', whiteSpace: 'nowrap' }}>{a.progression} %</span>
                              </div>
                            </td>
                            <td style={{ padding: '11px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              {a.suivi ? (
                                <span style={{ fontWeight: 600, color: a.suivi.lecons_terminees === a.suivi.lecons_total ? '#065f46' : '#374151' }}>{a.suivi.lecons_terminees}/{a.suivi.lecons_total}</span>
                              ) : <span style={{ color: '#d1d5db' }}>—</span>}
                              {a.suivi && a.suivi.videos_obligatoires > 0 && (
                                <div style={{ fontSize: '10px', color: '#9ca3af' }}>🎬 {a.suivi.videos_vues}/{a.suivi.videos_obligatoires} vidéos</div>
                              )}
                            </td>
                            <td style={{ padding: '11px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              {a.suivi && a.suivi.attestations_requises > 0 ? (
                                <span style={{
                                  padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                                  background: a.suivi.attestations_signees === a.suivi.attestations_requises ? '#d1fae5' : '#fef3c7',
                                  color: a.suivi.attestations_signees === a.suivi.attestations_requises ? '#065f46' : '#92400e',
                                }}>✍️ {a.suivi.attestations_signees}/{a.suivi.attestations_requises}</span>
                              ) : <span style={{ color: '#d1d5db' }}>—</span>}
                            </td>
                            <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                              {a.certificat ? (
                                <div>
                                  <span style={{ background: a.certificat_valide ? '#e0e7ff' : '#fee2e2', color: a.certificat_valide ? '#4338ca' : '#b91c1c', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, display: 'inline-block' }}>
                                    {a.certificat_valide ? 'Valide' : 'Expiré'}
                                  </span>
                                  {a.certificat.date_emission && <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '2px' }}>{date(a.certificat.date_emission)}</div>}
                                </div>
                              ) : <span style={{ color: '#d1d5db' }}>—</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </details>
          )
        })}
      </div>
    </div>
  )
}
