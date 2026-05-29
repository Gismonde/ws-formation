import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let { data: employe, error: empError } = await supabase
    .from('employes')
    .select('id, prenom, nom, role, departement, poste, email, actif')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!employe && !empError && user.email) {
    const { data: employeByEmail } = await supabase
      .from('employes')
      .select('id, prenom, nom, role, departement, poste, email, actif')
      .eq('email', user.email)
      .maybeSingle()
    if (employeByEmail) {
      await supabase.from('employes').update({ auth_user_id: user.id }).eq('id', employeByEmail.id)
      employe = employeByEmail
    }
  }

  if (empError) {
    return (
      <div style={{ textAlign: 'center', padding: '48px' }}>
        <p style={{ color: '#dc2626' }}>Erreur de configuration. Contactez votre administrateur.</p>
      </div>
    )
  }

  if (!employe) redirect('/login')

  const { data: assignations } = await supabase
    .from('assignations')
    .select('formation_id')
    .eq('employe_id', employe.id)

  const assignedIds = assignations?.map((a: any) => a.formation_id) ?? []

  let formations: any[] = []
  if (assignedIds.length > 0) {
    const { data } = await supabase
      .from('formations')
      .select('*')
      .eq('publiee', true)
      .in('id', assignedIds)
      .order('created_at', { ascending: false })
    formations = data ?? []
  }

  const { data: progressions } = await supabase
    .from('progressions')
    .select('formation_id, module_id, statut')
    .eq('employe_id', employe.id)

  const { data: certificats } = await supabase
    .from('certificats')
    .select('formation_id')
    .eq('employe_id', employe.id)

  const certSet = new Set(certificats?.map((c: any) => c.formation_id) ?? [])

  const formationsAvecProgression = await Promise.all(
    formations.map(async (f: any) => {
      const { data: modules } = await supabase.from('modules').select('id').eq('formation_id', f.id)
      const total = modules?.length ?? 0
      const termines = progressions?.filter((p: any) => p.formation_id === f.id && p.statut === 'termine').length ?? 0
      const pct = total > 0 ? Math.round((termines / total) * 100) : 0
      return { ...f, progressionPct: pct, certifie: certSet.has(f.id) }
    })
  )

  const termineeCount = formationsAvecProgression.filter(f => f.progressionPct === 100).length
  const enCoursCount = formationsAvecProgression.filter(f => f.progressionPct > 0 && f.progressionPct < 100).length

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1a1f36', margin: 0 }}>Bonjour, {employe.prenom} !</h1>
        <p style={{ color: '#6b7280', marginTop: '4px', fontSize: '14px' }}>Voici vos formations assignees.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px' }}>
          <p style={{ fontSize: '28px', fontWeight: '700', color: '#6366f1', margin: 0 }}>{formationsAvecProgression.length}</p>
          <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>Formation(s) assignee(s)</p>
        </div>
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px' }}>
          <p style={{ fontSize: '28px', fontWeight: '700', color: '#f59e0b', margin: 0 }}>{enCoursCount}</p>
          <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>En cours</p>
        </div>
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px' }}>
          <p style={{ fontSize: '28px', fontWeight: '700', color: '#10b981', margin: 0 }}>{termineeCount}</p>
          <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>Terminee(s)</p>
        </div>
      </div>

      {formationsAvecProgression.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '48px', textAlign: 'center' }}>
          <p style={{ fontSize: '40px', marginBottom: '12px' }}>📚</p>
          <p style={{ color: '#6b7280', fontSize: '15px' }}>Aucune formation ne vous a encore ete assignee.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
          {formationsAvecProgression.map((f: any) => (
            <Link key={f.id} href={`/formations/${f.id}`} style={{ textDecoration: 'none' }}>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer' }}>
                <div style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  <span style={{ fontSize: '36px' }}>📚</span>
                  {f.certifie && <span style={{ position: 'absolute', top: '8px', right: '8px', background: '#fbbf24', color: '#78350f', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px' }}>🏆 Certifie</span>}
                </div>
                <div style={{ padding: '16px' }}>
                  <h3 style={{ fontWeight: '600', color: '#1a1f36', fontSize: '14px', margin: '0 0 4px 0' }}>{f.titre}</h3>
                  <p style={{ color: '#6b7280', fontSize: '12px', marginBottom: '12px' }}>{f.description?.slice(0, 60)}{f.description?.length > 60 ? '...' : ''}</p>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                      <span>Progression</span><span style={{ fontWeight: '500' }}>{f.progressionPct}%</span>
                    </div>
                    <div style={{ background: '#f3f4f6', borderRadius: '99px', height: '6px' }}>
                      <div style={{ height: '6px', borderRadius: '99px', background: f.progressionPct === 100 ? '#10b981' : '#6366f1', width: `${f.progressionPct}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
