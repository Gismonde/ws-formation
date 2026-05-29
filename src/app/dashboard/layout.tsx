import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const employeNav = [
  { href: '/dashboard', label: 'Mes formations', icon: 'school' },
  { href: '/dashboard/certificats', label: 'Mes certificats', icon: 'workspace_premium' },
  { href: '/dashboard/sop', label: 'Mes SOP', icon: 'description' },
  { href: '/dashboard/historique', label: 'Historique', icon: 'history' },
  { href: '/dashboard/profil', label: 'Profil', icon: 'person' },
  ]

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

  let employe = null
    try {
          const serviceClient = createServiceClient(
                  process.env.NEXT_PUBLIC_SUPABASE_URL!,
                  process.env.SUPABASE_SERVICE_ROLE_KEY!
                )
          const { data } = await serviceClient
            .from('employes')
            .select('id, nom, prenom, role')
            .eq('auth_user_id', user.id)
            .single()
          employe = data
    } catch {}

  const role = employe?.role ?? 'employe'
    const isAdminOrManager = role === 'admin' || role === 'gestionnaire'

  return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#f0f2f5' }}>
                <style>{`
                        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                                @import url('https://fonts.googleapis.com/icon?family=Material+Icons');
                                        .employe-nav-link { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; color: rgba(255,255,255,0.65); text-decoration: none; font-size: 14px; font-weight: 500; margin-bottom: 2px; transition: all 0.15s ease; }
                                                .employe-nav-link:hover { background: rgba(255,255,255,0.1); color: #fff; }
                                                        .employe-main-content { margin-left: 240px; flex: 1; display: flex; flex-direction: column; min-height: 100vh; }
                                                              `}</style>style>
        
              <aside style={{ width: '240px', background: 'linear-gradient(180deg, #1a1f36 0%, #0d1117 100%)', color: '#fff', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100 }}>
                      <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                <div style={{ fontWeight: '700', fontSize: '15px', color: '#fff' }}>WS Formation</div>div>
                                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Mon espace</div>div>
                      </div>div>
              
                      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
                        {employeNav.map((item) => (
                      <Link key={item.href} href={item.href} className="employe-nav-link">
                                    <span className="material-icons" style={{ fontSize: '18px' }}>{item.icon}</span>span>
                        {item.label}
                      </Link>Link>
                    ))}
                      </nav>nav>
              
                      <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        {employe && (
                      <div style={{ marginBottom: '12px', fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
                        {employe.prenom} {employe.nom}
                      </div>div>
                                )}
                        {isAdminOrManager && (
                      <Link href="/admin" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: '13px', marginBottom: '6px' }}>
                                    <span className="material-icons" style={{ fontSize: '16px' }}>admin_panel_settings</span>span>
                                    Espace Admin
                      </Link>Link>
                                )}
                                <form action="/api/auth/signout" method="POST">
                                            <button type="submit" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px', width: '100%' }}>
                                                          <span className="material-icons" style={{ fontSize: '16px' }}>logout</span>span>
                                                          Deconnexion
                                            </button>button>
                                </form>form>
                      </div>div>
              </aside>aside>
        
              <main className="employe-main-content">
                      <div style={{ padding: '32px', flex: 1 }}>{children}</div>div>
              </main>main>
        </div>div>
      )
}</style>
