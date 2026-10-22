import { i18n } from '@/lib/i18n/serveur'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import ToggleActifButton from './ToggleActifButton'
import ZoneSelection from './ZoneSelection'
import { getActeur, serviceClient, filtrerEmployes, peutGererEmploye, cliniquesAdministrees } from '@/lib/permissions'
import { aAccesAdmin, ROLE_LABEL, CLINIQUE_INFO, Clinique, gestionnaireAvecDroits } from '@/lib/cliniques'
import { CliniqueBadge } from '@/components/CliniqueBadge'

const roleStyles: Record<string, { bg: string; color: string; border: string }> = {
  super_admin: { bg: '#faf5ff', color: '#7c3aed', border: '#e9d5ff' },
  admin: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  gestionnaire: { bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' },
  employe: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
}
const roleLabel: Record<string, string> = ROLE_LABEL

export default async function AdminEmployesPage({ searchParams }: { searchParams: Promise<{ clinique?: string }> }) {
  const { t } = await i18n()
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!aAccesAdmin(acteur)) redirect('/dashboard/accueil')

  const { clinique: filtreClinique } = await searchParams
  const sb = serviceClient()
  const isGestionnaire = acteur.role === 'gestionnaire'
  const mesCliniques = cliniquesAdministrees(acteur)
  const afficherFiltre = mesCliniques.length > 1

  let query = filtrerEmployes(sb.from('employes').select('*, departements(nom)').order('nom'), acteur)
  if (afficherFiltre && (filtreClinique === 'CMC' || filtreClinique === 'WSSC')) {
    // L'administrateur global (sans clinique enregistrée) couvre les deux cliniques
    query = acteur.role === 'super_admin'
      ? query.or(`clinique.in.(${filtreClinique},LES_DEUX),role.eq.super_admin`)
      : query.in('clinique', [filtreClinique, 'LES_DEUX'])
  }
  const { data: employes } = await query
  const ids = (employes ?? []).map((e: any) => e.id)

  const { data: assignations } = ids.length
    ? await sb.from('assignations').select('employe_id, formation_id').in('employe_id', ids)
    : { data: [] as any[] }
  const { data: certificats } = ids.length
    ? await sb.from('certificats').select('employe_id').eq('valide', true).in('employe_id', ids)
    : { data: [] as any[] }

  const nbAssign = (id: string) => assignations?.filter((a: any) => a.employe_id === id).length ?? 0
  const nbCerts = (id: string) => certificats?.filter((c: any) => c.employe_id === id).length ?? 0
  const peutGerer = (emp: any) => peutGererEmploye(acteur, emp)
  const peutCreer = !isGestionnaire || (!!acteur.departement_id && !!acteur.clinique)

  const sousTitre = acteur.role === 'super_admin' && !acteur.vue ? t('dans les deux cliniques')
    : acteur.role === 'super_admin' || acteur.role === 'admin' ? t('au {cliniques}', { cliniques: mesCliniques.join(t(' et au ')) })
    : t('dans votre département') + (acteur.clinique ? ' (' + acteur.clinique.replace('LES_DEUX', 'CMC + WSSC') + ')' : '')

  const actifs = employes?.filter((e: any) => e.actif !== false) ?? []
  const archives = employes?.filter((e: any) => e.actif === false) ?? []

  const tableStyle = {
    background: '#fff',
    borderRadius: '16px',
    border: '1px solid #e5e7eb',
    overflowX: 'auto' as const,
    boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)',
  }
  const thStyle = {
    textAlign: 'left' as const,
    padding: '12px 16px',
    fontWeight: '600' as const,
    color: '#6b7280',
    fontSize: '12px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    background: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
  }
  const tdStyle = { padding: '14px 16px', fontSize: '14px', color: '#374151' }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: 0, letterSpacing: '-0.5px' }}>
            {t('Employés')}
          </h1>
          <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px', margin: '4px 0 0 0' }}>
            {t('{n} employé(s) actif(s)', { n: actifs.length })} {sousTitre}
          </p>
        </div>
        {peutCreer && (
          <div style={{ display: 'flex', gap: '8px' }}>
          <Link href="/admin/employes/importer" style={{
            display: 'inline-flex', alignItems: 'center', padding: '10px 18px', background: '#fff', color: '#374151',
            border: '1px solid #d1d5db', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '600',
          }}>
            {t('⬆ Importer (Excel/CSV)')}
          </Link>
          <Link href="/admin/employes/nouveau" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 18px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: '#fff',
            borderRadius: '8px',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: '600',
            boxShadow: '0 2px 8px rgba(99,102,241,0.35)',
          }}>
            {t('+ Créer un employé')}
          </Link>
          </div>
        )}
      </div>

      {afficherFiltre && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          {[{ v: '', l: t('Toutes les cliniques') }, ...(['CMC', 'WSSC'] as Clinique[]).map(c => ({ v: c, l: CLINIQUE_INFO[c].nom }))].map(f => {
            const actif = (filtreClinique ?? '') === f.v
            return (
              <Link key={f.v} href={f.v ? `/admin/employes?clinique=${f.v}` : '/admin/employes'} style={{
                padding: '7px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 600, textDecoration: 'none',
                background: actif ? '#1a1f36' : '#fff', color: actif ? '#fff' : '#374151', border: '1px solid #e5e7eb',
              }}>{f.l}</Link>
            )
          })}
        </div>
      )}

      <ZoneSelection>
      {/* Active employees table */}
      <div style={{ ...tableStyle, marginBottom: '32px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: '14px' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: '36px', paddingRight: 0 }}><input type="checkbox" data-tout="actifs" aria-label={t('Sélectionner tous les employés actifs')} /></th>
              <th style={thStyle}>{t('Nom')}</th>
              <th style={thStyle}>{t('Email')}</th>
              <th style={thStyle}>{t('Clinique')}</th>
              <th style={thStyle}>{t('Département')}</th>
              <th style={thStyle}>{t('Rôle')}</th>
              <th style={{ ...thStyle, textAlign: 'center' as const }}>{t('Formations')}</th>
              <th style={{ ...thStyle, textAlign: 'center' as const }}>{t('Certificats')}</th>
              <th style={{ ...thStyle, textAlign: 'center' as const }}>{t('Statut')}</th>
              <th style={{ ...thStyle, textAlign: 'center' as const }}>{t('Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {actifs.map((emp: any, i: number) => {
              const rs = roleStyles[emp.role] ?? { bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb' }
              return (
                <tr key={emp.id} style={{ borderBottom: i < actifs.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                  <td style={{ ...tdStyle, paddingRight: 0 }}>
                    <input type="checkbox" name="employe" value={emp.id} data-groupe="actifs" data-actif="1" data-gerable={peutGerer(emp) ? '1' : '0'} aria-label={`Sélectionner ${emp.prenom} ${emp.nom}`} />
                  </td>
                  <td style={tdStyle}>
                    <Link href={`/admin/employes/${emp.id}`} style={{ fontWeight: '600', color: '#111827', textDecoration: 'none' }}>{emp.prenom} {emp.nom}</Link>
                    {emp.poste && <div style={{ fontSize: '12px', color: '#9ca3af' }}>{emp.poste}</div>}
                  </td>
                  <td style={{ ...tdStyle, color: '#6b7280' }}>{emp.email}</td>
                  <td style={tdStyle}><CliniqueBadge clinique={emp.clinique} role={emp.role} /></td>
                  <td style={{ ...tdStyle, color: '#9ca3af', fontStyle: 'italic' }}>{emp.departements?.nom ?? t('Non assigné')}</td>
                  <td style={tdStyle}>
                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '20px', background: rs.bg, color: rs.color, fontSize: '12px', fontWeight: '600', border: `1px solid ${rs.border}` }}>
                      {t(roleLabel[emp.role] ?? emp.role)}
                    </span>
                    {emp.role === 'gestionnaire' && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                        {([['peut_suivre_employes', '👥', t('Suivi')], ['peut_creer_formations', '✏️', t('Formations')], ['peut_valider_formations', '✅', t('Validation')], ['peut_creer_evenements', '📅', t('Événements')]] as const)
                          .filter(([cle]) => emp[cle]).map(([cle, icone, libelle]) => (
                            <span key={cle} style={{ padding: '1px 7px', borderRadius: '20px', background: '#eef2ff', color: '#4f46e5', fontSize: '11px', fontWeight: 600, border: '1px solid #c7d2fe' }}>{icone} {libelle}</span>
                          ))}
                        {!gestionnaireAvecDroits(emp) && <span style={{ fontSize: '11px', color: '#9ca3af' }}>{t('Sans accès admin')}</span>}
                      </div>
                    )}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' as const, fontWeight: '600' }}>{nbAssign(emp.id)}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' as const, fontWeight: '600' }}>{nbCerts(emp.id)}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' as const }}>
                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '20px', background: '#f0fdf4', color: '#16a34a', fontSize: '12px', fontWeight: '600', border: '1px solid #bbf7d0' }}>{t('Actif')}</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' as const }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <Link href={`/admin/employes/${emp.id}`} style={{ padding: '5px 12px', borderRadius: '6px', background: '#eef2ff', color: '#4f46e5', textDecoration: 'none', fontSize: '12px', fontWeight: '600', border: '1px solid #c7d2fe' }}>
                        {t('Dossier')}
                      </Link>
                      <Link href={`/admin/employes/${emp.id}?onglet=preuves`} style={{ padding: '5px 12px', borderRadius: '6px', background: '#fefce8', color: '#ca8a04', textDecoration: 'none', fontSize: '12px', fontWeight: '600', border: '1px solid #fde68a' }}>
                        {t('Preuves')}
                      </Link>
                      {peutGerer(emp) && <ToggleActifButton id={emp.id} actif={true} nom={`${emp.prenom} ${emp.nom}`} />}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Archived employees */}
      {archives.length > 0 && (
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#6b7280', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {t('Employés archivés')}
            <span style={{ background: '#e5e7eb', color: '#6b7280', fontSize: '12px', padding: '2px 8px', borderRadius: '20px' }}>{archives.length}</span>
          </h2>
          <div style={{ ...tableStyle, opacity: 0.8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: '14px' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: '36px', paddingRight: 0 }}><input type="checkbox" data-tout="archives" aria-label={t('Sélectionner tous les employés archivés')} /></th>
                  <th style={thStyle}>{t('Nom')}</th>
                  <th style={thStyle}>{t('Email')}</th>
                  <th style={thStyle}>{t('Clinique')}</th>
              <th style={thStyle}>{t('Département')}</th>
                  <th style={thStyle}>{t('Rôle')}</th>
                  <th style={{ ...thStyle, textAlign: 'center' as const }}>{t('Formations')}</th>
                  <th style={{ ...thStyle, textAlign: 'center' as const }}>{t('Certificats')}</th>
                  <th style={{ ...thStyle, textAlign: 'center' as const }}>{t('Statut')}</th>
                  <th style={{ ...thStyle, textAlign: 'center' as const }}>{t('Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {archives.map((emp: any, i: number) => (
                  <tr key={emp.id} style={{ borderBottom: i < archives.length - 1 ? '1px solid #f3f4f6' : 'none', color: '#9ca3af' }}>
                    <td style={{ ...tdStyle, paddingRight: 0 }}>
                      <input type="checkbox" name="employe" value={emp.id} data-groupe="archives" data-actif="0" data-gerable={peutGerer(emp) ? '1' : '0'} aria-label={`Sélectionner ${emp.prenom} ${emp.nom}`} />
                    </td>
                    <td style={tdStyle}>
                      <Link href={`/admin/employes/${emp.id}`} style={{ fontWeight: '500', color: 'inherit', textDecoration: 'none' }}>{emp.prenom} {emp.nom}</Link>
                      {emp.poste && <div style={{ fontSize: '12px' }}>{emp.poste}</div>}
                    </td>
                    <td style={tdStyle}>{emp.email}</td>
                    <td style={tdStyle}><CliniqueBadge clinique={emp.clinique} role={emp.role} /></td>
                    <td style={{ ...tdStyle, fontStyle: 'italic' }}>{emp.departements?.nom ?? t('Non assigné')}</td>
                    <td style={tdStyle}>{t(roleLabel[emp.role] ?? emp.role)}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' as const }}>{nbAssign(emp.id)}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' as const }}>{nbCerts(emp.id)}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' as const }}>
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '20px', background: '#f3f4f6', color: '#9ca3af', fontSize: '12px', fontWeight: '600', border: '1px solid #e5e7eb' }}>{t('Archivé')}</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' as const }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <Link href={`/admin/employes/${emp.id}`} style={{ padding: '5px 12px', borderRadius: '6px', background: '#f3f4f6', color: '#6b7280', textDecoration: 'none', fontSize: '12px', fontWeight: '600', border: '1px solid #e5e7eb' }}>
                          {t('Dossier')}
                        </Link>
                        {peutGerer(emp) && <ToggleActifButton id={emp.id} actif={false} nom={`${emp.prenom} ${emp.nom}`} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </ZoneSelection>
    </div>
  )
}
