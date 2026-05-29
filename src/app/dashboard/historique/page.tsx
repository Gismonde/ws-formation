import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function HistoriquePage() {
  const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
      if (!user) redirect('/login')

        const { data: employe } = await supabase
            .from('employes')
                .select('id')
                    .eq('auth_user_id', user.id)
                        .single()

                          if (!employe) redirect('/login')

                            const { data: progressions } = await supabase
                                .from('progressions')
                                    .select('id, statut, updated_at, module_id, formation_id, modules(titre), formations(titre)')
                                        .eq('employe_id', employe.id)
                                            .order('updated_at', { ascending: false })
                                                .limit(50)

                                                  return (
                                                      <div>
                                                            <div style={{ marginBottom: '32px' }}>
                                                                    <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1a1f36', margin: 0 }}>Historique</h1>
                                                                            <p style={{ color: '#6b7280', marginTop: '4px', fontSize: '14px' }}>Votre historique de progression</p>
                                                                                  </div>
                                                                                        {!progressions || progressions.length === 0 ? (
                                                                                                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '48px', textAlign: 'center' }}>
                                                                                                          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📅</div>
                                                                                                                    <p style={{ color: '#6b7280', fontSize: '15px' }}>Aucune activite enregistree.</p>
                                                                                                                            </div>
                                                                                                                                  ) : (
                                                                                                                                          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                                                                                                                                                    {progressions.map((prog: any, idx: number) => (
                                                                                                                                                                <div key={prog.id} style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '16px', borderBottom: idx < progressions.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                                                                                                                                                                              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: prog.statut === 'termine' ? '#d1fae5' : '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
                                                                                                                                                                                              {prog.statut === 'termine' ? '✓' : '⏳'}
                                                                                                                                                                                                            </div>
                                                                                                                                                                                                                          <div style={{ flex: 1 }}>
                                                                                                                                                                                                                                          <p style={{ fontWeight: '500', color: '#1a1f36', fontSize: '14px', margin: 0 }}>
                                                                                                                                                                                                                                                            {(prog.modules as any)?.titre ?? 'Module'} — <span style={{ color: '#6b7280' }}>{(prog.formations as any)?.titre ?? ''}</span>
                                                                                                                                                                                                                                                                            </p>
                                                                                                                                                                                                                                                                                            <p style={{ color: '#9ca3af', fontSize: '12px', marginTop: '2px' }}>
                                                                                                                                                                                                                                                                                                              {prog.updated_at ? new Date(prog.updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
                                                                                                                                                                                                                                                                                                                              </p>
                                                                                                                                                                                                                                                                                                                                            </div>
                                                                                                                                                                                                                                                                                                                                                          <span style={{ fontSize: '12px', fontWeight: '600', padding: '3px 10px', borderRadius: '20px', background: prog.statut === 'termine' ? '#d1fae5' : '#fef3c7', color: prog.statut === 'termine' ? '#065f46' : '#92400e' }}>
                                                                                                                                                                                                                                                                                                                                                                          {prog.statut === 'termine' ? 'Termine' : 'En cours'}
                                                                                                                                                                                                                                                                                                                                                                                        </span>
                                                                                                                                                                                                                                                                                                                                                                                                    </div>
                                                                                                                                                                                                                                                                                                                                                                                                              ))}
                                                                                                                                                                                                                                                                                                                                                                                                                      </div>
                                                                                                                                                                                                                                                                                                                                                                                                                            )}
                                                                                                                                                                                                                                                                                                                                                                                                                                </div>
                                                                                                                                                                                                                                                                                                                                                                                                                                  )
                                                                                                                                                                                                                                                                                                                                                                                                                                  }
