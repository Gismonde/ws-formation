import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

type StatutFormation = 'non_commence' | 'en_cours' | 'termine'

type FormationEmploye = {
  employe_id: string
  employe_nom: string
  employe_prenom: string
  employe_email: string
  departement: string
  formation_id: string
  formation_titre: string
  statut: StatutFormation
  progression: number
  date_fin: string | null
}

export default async function ConformitePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminSupabase = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: moi } = await adminSupabase
    .from('employes')
    .select('role, departement_id')
    .eq('auth_user_id', user!.id)
    .single()

  const isGestionnaire = moi?.role === 'gestionnaire'

  let employesQuery = adminSupabase
    .from('employes')
    .select('id, nom, prenom, email, departement')
    .eq('archive', false)

  if (isGestionnaire && moi?.departement_id) {
    employesQuery = employesQuery.eq('departement_id', moi.departement_id)
  }

  const { data: employes } = await employesQuery
  const { data: formations } = await adminSupabase
    .from('formations')
    .select('id, titre')

  const { data: progressions } = await adminSupabase
    .from('progression')
    .select('employe_id, formation_id, statut, progression')

  const { data: certificats } = await adminSupabase
    .from('certificats')
    .select('employe_id, formation_id, issued_at')

  const employes_ = employes ?? []
  const formations_ = formations ?? []
  const progressions_ = progressions ?? []
  const certificats_ = certificats ?? []

  const rows: FormationEmploye[] = []
  for (const emp of employes_) {
    for (const form of formations_) {
      const prog = progressions_.find(p => p.employe_id === emp.id && p.formation_id === form.id)
      const cert = certificats_.find(c => c.employe_id === emp.id && c.formation_id === form.id)
      rows.push({
        employe_id: emp.id,
        employe_nom: emp.nom ?? '',
        employe_prenom: emp.prenom ?? '',
        employe_email: emp.email ?? '',
        departement: emp.departement ?? '',
        formation_id: form.id,
        formation_titre: form.titre,
        statut: prog?.statut ?? 'non_commence',
        progression: prog?.progression ?? 0,
        date_fin: cert?.issued_at ?? null,
      })
    }
  }

  const total = rows.length
  const termines = rows.filter(r => r.statut === 'termine').length
  const enCours = rows.filter(r => r.statut === 'en_cours').length
  const nonCommence = rows.filter(r => r.statut === 'non_commence').length
  const tauxConformite = total > 0 ? Math.round((termines / total) * 100) : 0

  function statutBadge(statut: StatutFormation) {
    const cfg = {
      non_commence: { bg: '#f3f4f6', color: '#6b7280', label: 'Non commence' },
      en_cours: { bg: '#fef3c7', color: '#92400e', label: 'En cours' },
      termine: { bg: '#d1fae5', color: '#065f46', label: 'Termine' },
    }
    const c = cfg[statut]
    return (
      <span style={{ background: c.bg, color: c.color, padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>
        {c.label}
      </span>
    )
  }

  const depts = Array.from(new Set(rows.map(r => r.departement).filter(Boolean))).sort()

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1a1f36', margin: 0 }}>Conformite</h1>
        <p style={{ color: '#6b7280', marginTop: '4px', fontSize: '14px' }}>
          Suivi de la conformite reglementaire des employes
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
        {[
          { label: 'Taux de conformite', value: tauxConformite + '%', color: '#6366f1', bg: '#eef2ff' },
          { label: 'Formations terminees', value: termines, color: '#065f46', bg: '#d1fae5' },
          { label: 'En cours', value: enCours, color: '#92400e', bg: '#fef3c7' },
          { label: 'Non commencees', value: nonCommence, color: '#991b1b', bg: '#fee2e2' },
        ].map(stat => (
          <div key={stat.label} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px 24px' }}>
            <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>{stat.label}</p>
            <p style={{ margin: 0, fontSize: '28px', fontWeight: '700', color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {depts.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#1a1f36', marginBottom: '12px' }}>Par departement</h2>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {depts.map(dept => {
              const deptRows = rows.filter(r => r.departement === dept)
              const deptTermines = deptRows.filter(r => r.statut === 'termine').length
              const deptTaux = deptRows.length > 0 ? Math.round((deptTermines / deptRows.length) * 100) : 0
              return (
                <div key={dept} style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontWeight: '600', color: '#1a1f36', fontSize: '14px' }}>{dept}</span>
                  <span style={{ background: deptTaux >= 80 ? '#d1fae5' : deptTaux >= 50 ? '#fef3c7' : '#fee2e2', color: deptTaux >= 80 ? '#065f46' : deptTaux >= 50 ? '#92400e' : '#991b1b', padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600' }}>
                    {deptTaux}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1a1f36' }}>Detail des conformites</h2>
        </div>
        {rows.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>Aucune donnee disponible.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Employe', 'Departement', 'Formation', 'Statut', 'Progression', 'Date fin'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#6b7280', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.employe_id + row.formation_id} style={{ borderTop: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: '600', color: '#1a1f36' }}>{row.employe_prenom} {row.employe_nom}</div>
                      <div style={{ fontSize: '11px', color: '#9ca3af' }}>{row.employe_email}</div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#6b7280' }}>{row.departement || '-'}</td>
                    <td style={{ padding: '12px 16px', color: '#1a1f36', fontWeight: '500' }}>{row.formation_titre}</td>
                    <td style={{ padding: '12px 16px' }}>{statutBadge(row.statut)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, background: '#e5e7eb', borderRadius: '4px', height: '6px', minWidth: '60px' }}>
                          <div style={{ width: row.progression + '%', background: row.statut === 'termine' ? '#10b981' : '#6366f1', height: '6px', borderRadius: '4px' }} />
                        </div>
                        <span style={{ fontSize: '11px', color: '#6b7280', whiteSpace: 'nowrap' }}>{row.progression}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#6b7280' }}>
                      {row.date_fin ? new Date(row.date_fin).toLocaleDateString('fr-FR') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
