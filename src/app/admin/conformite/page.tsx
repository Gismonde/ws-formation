import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import Link from 'next/link'

type StatutFormation = 'non_commence' | 'en_cours' | 'termine'

type AssignationDetail = {
  formation_id: string
  formation_titre: string
  statut: StatutFormation
  progression: number
  certificat_valide: boolean
  certificat_date: string | null
}

type EmployeConformite = {
  id: string
  nom: string
  prenom: string
  email: string
  departement: string
  assignations: AssignationDetail[]
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
    .select('id, nom, prenom, email, departement, actif, departements(nom)')
    .order('nom')

  if (isGestionnaire && moi?.departement_id) {
    employesQuery = employesQuery.eq('departement_id', moi.departement_id)
  }

  const { data: employes } = await employesQuery
  const { data: formations } = await adminSupabase.from('formations').select('id, titre')
  const { data: assignations } = await adminSupabase.from('assignations').select('employe_id, formation_id')
  const { data: progressions } = await adminSupabase.from('progression').select('employe_id, formation_id, statut, progression')
  const { data: certificats } = await adminSupabase.from('certificats').select('employe_id, formation_id, valide, issued_at')

  // Filter active employees in JS (actif !== false handles null/true/undefined)
  const employes_ = (employes ?? []).filter((e: any) => e.actif !== false)
  const formations_ = formations ?? []
  const assignations_ = assignations ?? []
  const progressions_ = progressions ?? []
  const certificats_ = certificats ?? []

  const data: EmployeConformite[] = employes_.map((emp: any) => {
    const empAssignations = assignations_.filter((a: any) => a.employe_id === emp.id)
    const details: AssignationDetail[] = empAssignations.map((a: any) => {
      const form = formations_.find((f: any) => f.id === a.formation_id)
      const prog = progressions_.find((p: any) => p.employe_id === emp.id && p.formation_id === a.formation_id)
      const cert = certificats_.find((c: any) => c.employe_id === emp.id && c.formation_id === a.formation_id && c.valide)
      return {
        formation_id: a.formation_id,
        formation_titre: form?.titre ?? 'Formation inconnue',
        statut: (prog?.statut as StatutFormation) ?? 'non_commence',
        progression: prog?.progression ?? 0,
        certificat_valide: !!cert,
        certificat_date: cert?.issued_at ?? null,
      }
    })
    return {
      id: emp.id,
      nom: emp.nom ?? '',
      prenom: emp.prenom ?? '',
      email: emp.email ?? '',
      departement: (emp as any).departements?.nom ?? emp.departement ?? '',
      assignations: details,
    }
  })

  const totalAssign = data.reduce((s, e) => s + e.assignations.length, 0)
  const totalTermines = data.reduce((s, e) => s + e.assignations.filter(a => a.statut === 'termine').length, 0)
  const totalEnCours = data.reduce((s, e) => s + e.assignations.filter(a => a.statut === 'en_cours').length, 0)
  const totalCerts = data.reduce((s, e) => s + e.assignations.filter(a => a.certificat_valide).length, 0)
  const taux = totalAssign > 0 ? Math.round((totalTermines / totalAssign) * 100) : 0

  const statutConfig: Record<StatutFormation, { bg: string; color: string; label: string }> = {
    non_commence: { bg: '#f3f4f6', color: '#6b7280', label: 'Non commence' },
    en_cours: { bg: '#fef3c7', color: '#92400e', label: 'En cours' },
    termine: { bg: '#d1fae5', color: '#065f46', label: 'Termine' },
  }

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1a1f36', margin: 0 }}>Conformite</h1>
        <p style={{ color: '#6b7280', marginTop: '4px', fontSize: '14px' }}>
          Suivi de la conformite reglementaire - {data.length} employe(s) actif(s)
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '32px' }}>
        {[
          { label: 'Taux conformite', value: taux + '%', color: taux >= 80 ? '#065f46' : taux >= 50 ? '#92400e' : '#991b1b' },
          { label: 'Formations assignees', value: String(totalAssign), color: '#1a1f36' },
          { label: 'Terminees', value: String(totalTermines), color: '#065f46' },
          { label: 'Certificats obtenus', value: String(totalCerts), color: '#4338ca' },
        ].map(stat => (
          <div key={stat.label} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '18px 20px' }}>
            <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>{stat.label}</p>
            <p style={{ margin: 0, fontSize: '26px', fontWeight: '700', color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {data.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
            Aucun employe actif trouve.
          </div>
        ) : data.map(emp => {
          const empTermines = emp.assignations.filter(a => a.statut === 'termine').length
          const empTotal = emp.assignations.length
          const empTaux = empTotal > 0 ? Math.round((empTermines / empTotal) * 100) : 0
          const empCerts = emp.assignations.filter(a => a.certificat_valide).length
          const tauxColor = empTaux >= 80 ? '#065f46' : empTaux >= 50 ? '#92400e' : '#6b7280'

          return (
            <details key={emp.id} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              <summary style={{ padding: '16px 20px', cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', minWidth: 0 }}>
                  <div style={{ minWidth: '180px' }}>
                    <div style={{ fontWeight: '700', color: '#1a1f36', fontSize: '14px' }}>{emp.prenom} {emp.nom}</div>
                    <div style={{ fontSize: '12px', color: '#9ca3af' }}>{emp.email}</div>
                  </div>
                  {emp.departement && (
                    <span style={{ fontSize: '12px', color: '#6b7280', background: '#f3f4f6', padding: '2px 10px', borderRadius: '20px', whiteSpace: 'nowrap' }}>
                      {emp.departement}
                    </span>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ background: '#e5e7eb', borderRadius: '4px', height: '8px', width: '80px' }}>
                      <div style={{ width: empTaux + '%', background: empTaux >= 80 ? '#10b981' : empTaux >= 50 ? '#f59e0b' : '#9ca3af', height: '8px', borderRadius: '4px' }} />
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: tauxColor }}>{empTaux}%</span>
                  </div>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>{empTermines}/{empTotal} formations</span>
                  {empCerts > 0 && (
                    <span style={{ fontSize: '12px', color: '#4338ca', background: '#e0e7ff', padding: '1px 8px', borderRadius: '20px', fontWeight: '600' }}>
                      {empCerts} cert.
                    </span>
                  )}
                </div>
                <span style={{ color: '#9ca3af', fontSize: '14px', flexShrink: 0 }}>&#9660;</span>
              </summary>
              <div style={{ padding: '8px 20px', borderTop: '1px solid #f3f4f6', background: '#f9fafb', display: 'flex', justifyContent: 'flex-end' }}>
                <Link href={'/admin/employes/' + emp.id} style={{ padding: '5px 12px', borderRadius: '6px', background: '#eff6ff', color: '#2563eb', textDecoration: 'none', fontSize: '12px', fontWeight: '600', border: '1px solid #bfdbfe' }}>
                  Voir le dossier
                </Link>
              </div>
              <div style={{ borderTop: '1px solid #f3f4f6' }}>
                {emp.assignations.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>Aucune formation assignee.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        <th style={{ padding: '10px 20px', textAlign: 'left', fontWeight: '600', color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #f3f4f6' }}>Formation</th>
                        <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '600', color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #f3f4f6' }}>Statut</th>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '600', color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #f3f4f6' }}>Progression</th>
                        <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '600', color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #f3f4f6' }}>Certificat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {emp.assignations.map((a, i) => {
                        const sc = statutConfig[a.statut]
                        return (
                          <tr key={a.formation_id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                            <td style={{ padding: '12px 20px', fontWeight: '500', color: '#1a1f36' }}>{a.formation_titre}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              <span style={{ background: sc.bg, color: sc.color, padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600' }}>
                                {sc.label}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ flex: 1, background: '#e5e7eb', borderRadius: '4px', height: '6px', minWidth: '80px' }}>
                                  <div style={{ width: a.progression + '%', background: a.statut === 'termine' ? '#10b981' : '#6366f1', height: '6px', borderRadius: '4px' }} />
                                </div>
                                <span style={{ fontSize: '11px', color: '#6b7280', whiteSpace: 'nowrap' }}>{a.progression}%</span>
                              </div>
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              {a.certificat_valide ? (
                                <div>
                                  <span style={{ background: '#e0e7ff', color: '#4338ca', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', display: 'inline-block' }}>Obtenu</span>
                                  {a.certificat_date && (
                                    <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '2px' }}>
                                      {new Date(a.certificat_date).toLocaleDateString('fr-FR')}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: '#d1d5db' }}>-</span>
                              )}
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
