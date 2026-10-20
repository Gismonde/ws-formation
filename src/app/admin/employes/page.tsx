import Link from 'next/link'
import { redirect } from 'next/navigation'
import ToggleActifButton from './ToggleActifButton'
import { getActeur, serviceClient, filtrerEmployes, peutGererEmploye, cliniquesAdministrees } from '@/lib/permissions'
import { aAccesAdmin, ROLE_LABEL, CLINIQUE_INFO, Clinique } from '@/lib/cliniques'
import { CliniqueBadge } from '@/components/CliniqueBadge'

const roleStyles: Record<string, { bg: string; color: string; border: string }> = {
  super_admin: { bg: '#faf5ff', color: '#7c3aed', border: '#e9d5ff' },
  admin: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  gestionnaire: { bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' },
  employe: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
}
const roleLabel: Record<string, string> = ROLE_LABEL

export default async function AdminEmployesPage({ searchParams }: { searchParams: Promise<{ clinique?: string }> }) {
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!aAccesAdmin(acteur.role)) redirect('/dashboard/accueil')

  const { clinique: filtreClinique } = await searchParams
  const sb = serviceClient()
  const isGestionnaire = acteur.role === 'gestionnaire'
  const mesCliniques = cliniquesAdministrees(acteur)
  const afficherFiltre = mesCliniques.length > 1

  let query = filtrerEmployes(sb.from('employes').select('*, departements(nom)').order('nom'), acteur)
  if (afficherFiltre && (filtreClinique === 'CMC' || filtreClinique === 'WSSC')) {
    query = query.in('clinique', [filtreClinique, 'LES_DEUX'])
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

  const sousTitre = acteur.role === 'super_admin' && !acteur.vue ? 'dans les deux cliniques'
    : acteur.role === 'admin' ? 'à ' + mesCliniques.join(' et ')
    : `dans votre département${acteur.clinique ? ' (' + acteur.clinique.replace('LES_DEUX', 'CMC + WSSC') + ')' : ''}`

  const actifs = employes?.filter((e: any) => e.actif !== false) ?? []
  const archives = employes?.filter((e: any) => e.actif === false) ?? []

  const tableStyle = {
    background: '#fff',
    borderRadius: '16px',
    border: '1px solid #e5e7eb',
    overflow: 'hidden' as const,
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
            Employés
          </h1>
          <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px', margin: '4px 0 0 0' }}>
            {actifs.length} employé(s) actif(s) {sousTitre}
          </p>
        </div>
        {peutCreer && (
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
            + Créer un employé
          </Link>
        )}
      </div>

      {afficherFiltre && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          {[{ v: '', l: 'Toutes les cliniques' }, ...(['CMC', 'WSSC'] as Clinique[]).map(c => ({ v: c, l: CLINIQUE_INFO[c].nom }))].map(f => {
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

      {/* Active employees table */}
      <div style={{ ...tableStyle, marginBottom: '32px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: '14px' }}>
          <thead>
            <tr>
              <th style={thStyle}>Nom</th>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Clinique</th>
              <th style={thStyle}>Département</th>
              <th style={thStyle}>Rôle</th>
              <th style={{ ...thStyle, textAlign: 'center' as const }}>Formations</th>
              <th style={{ ...thStyle, textAlign: 'center' as const }}>Certificats</th>
              <th style={{ ...thStyle, textAlign: 'center' as const }}>Statut</th>
              <th style={{ ...thStyle, textAlign: 'center' as const }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {actifs.map((emp: any, i: number) => {
              const rs = roleStyles[emp.role] ?? { bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb' }
              return (
                <tr key={emp.id} style={{ borderBottom: i < actifs.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: '600', color: '#111827' }}>{emp.prenom} {emp.nom}</div>
                    {emp.poste && <div style={{ fontSize: '12px', color: '#9ca3af' }}>{emp.poste}</div>}
                  </td>
                  <td style={{ ...tdStyle, color: '#6b7280' }}>{emp.email}</td>
                  <td style={tdStyle}><CliniqueBadge clinique={emp.clinique} /></td>
                  <td style={{ ...tdStyle, color: '#9ca3af', fontStyle: 'italic' }}>{emp.departements?.nom ?? 'Non assigné'}</td>
                  <td style={tdStyle}>
                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '20px', background: rs.bg, color: rs.color, fontSize: '12px', fontWeight: '600', border: `1px solid ${rs.border}` }}>
                      {roleLabel[emp.role] ?? emp.role}
                    </span>
                    {emp.role === 'gestionnaire' && emp.peut_creer_formations && (
                      <span title="Peut créer des formations" style={{ display: 'inline-block', marginLeft: '6px', padding: '2px 8px', borderRadius: '20px', background: '#eef2ff', color: '#4f46e5', fontSize: '11px', fontWeight: 600, border: '1px solid #c7d2fe' }}>
                        ✏️ Formations
                      </span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' as const, fontWeight: '600' }}>{nbAssign(emp.id)}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' as const, fontWeight: '600' }}>{nbCerts(emp.id)}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' as const }}>
                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '20px', background: '#f0fdf4', color: '#16a34a', fontSize: '12px', fontWeight: '600', border: '1px solid #bbf7d0' }}>Actif</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' as const }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <Link href={`/admin/employes/${emp.id}`} style={{ padding: '5px 12px', borderRadius: '6px', background: '#eff6ff', color: '#2563eb', textDecoration: 'none', fontSize: '12px', fontWeight: '600', border: '1px solid #bfdbfe' }}>
                        {peutGerer(emp) ? 'Modifier' : 'Dossier'}
                      </Link>
                      <Link href={`/admin/employes/${emp.id}/preuves`} style={{ padding: '5px 12px', borderRadius: '6px', background: '#fefce8', color: '#ca8a04', textDecoration: 'none', fontSize: '12px', fontWeight: '600', border: '1px solid #fde68a' }}>
                        Preuves
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
            Employés archivés
            <span style={{ background: '#e5e7eb', color: '#6b7280', fontSize: '12px', padding: '2px 8px', borderRadius: '20px' }}>{archives.length}</span>
          </h2>
          <div style={{ ...tableStyle, opacity: 0.8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: '14px' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Nom</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Clinique</th>
              <th style={thStyle}>Département</th>
                  <th style={thStyle}>Rôle</th>
                  <th style={{ ...thStyle, textAlign: 'center' as const }}>Formations</th>
                  <th style={{ ...thStyle, textAlign: 'center' as const }}>Certificats</th>
                  <th style={{ ...thStyle, textAlign: 'center' as const }}>Statut</th>
                  <th style={{ ...thStyle, textAlign: 'center' as const }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {archives.map((emp: any, i: number) => (
                  <tr key={emp.id} style={{ borderBottom: i < archives.length - 1 ? '1px solid #f3f4f6' : 'none', color: '#9ca3af' }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: '500' }}>{emp.prenom} {emp.nom}</div>
                      {emp.poste && <div style={{ fontSize: '12px' }}>{emp.poste}</div>}
                    </td>
                    <td style={tdStyle}>{emp.email}</td>
                    <td style={tdStyle}><CliniqueBadge clinique={emp.clinique} /></td>
                    <td style={{ ...tdStyle, fontStyle: 'italic' }}>{emp.departements?.nom ?? 'Non assigné'}</td>
                    <td style={tdStyle}>{roleLabel[emp.role] ?? emp.role}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' as const }}>{nbAssign(emp.id)}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' as const }}>{nbCerts(emp.id)}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' as const }}>
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '20px', background: '#f3f4f6', color: '#9ca3af', fontSize: '12px', fontWeight: '600', border: '1px solid #e5e7eb' }}>Archivé</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' as const }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <Link href={`/admin/employes/${emp.id}`} style={{ padding: '5px 12px', borderRadius: '6px', background: '#f3f4f6', color: '#6b7280', textDecoration: 'none', fontSize: '12px', fontWeight: '600', border: '1px solid #e5e7eb' }}>
                          Dossier
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
    </div>
  )
}
