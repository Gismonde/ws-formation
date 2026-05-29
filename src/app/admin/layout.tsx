import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const adminNav = [
  { href: '/admin', label: 'Dashboard', icon: 'dashboard' },
  { href: '/admin/employes', label: 'Employés', icon: 'people' },
  { href: '/admin/formations', label: 'Formations', icon: 'school' },
  { href: '/admin/conformite', label: 'Conformité', icon: 'verified' },
  { href: '/admin/rapports', label: 'Rapports', icon: 'bar_chart' },
  { href: '/admin/sop', label: 'SOP', icon: 'description' },
  { href: '/admin/audit', label: 'Audit logs', icon: 'manage_search', adminOnly: true },
  { href: '/admin/parametres', label: 'Paramètres', icon: 'settings', adminOnly: true },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
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
  const isAdmin = role === 'admin'
  const visibleNav = adminNav.filter(item => !item.adminOnly || isAdmin)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f0f2f5', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @import url('https://fonts.googleapis.com/icon?family=Material+Icons');
        .admin-nav-link {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 8px;
          color: rgba(255,255,255,0.65);
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 2px;
          transition: all 0.15s ease;
        }
        .admin-nav-link:hover {
          background: rgba(255,255,255,0.1);
          color: #fff;
        }
        .admin-nav-link .material-icons {
          font-size: 18px;
          opacity: 0.8;
        }
        .admin-logout-btn:hover {
          background: rgba(255,255,255,0.12) !important;
        }
        .admin-main-content {
          margin-left: 240px;
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 100vh;
        }
      `}</style>

      {/* Sidebar */}
      <aside style={{
        width: '240px',
        background: 'linear-gradient(180deg, #1a1f36 0%, #0d1117 100%)',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 100,
        boxShadow: '4px 0 20px rgba(0,0,0,0.15)',
      }}>
        {/* Logo */}
        <div style={{
          padding: '24px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              fontWeight: '700',
              color: '#fff',
              flexShrink: 0,
            }}>W</div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#fff', letterSpacing: '-0.3px' }}>WS Formation</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Administration</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          {visibleNav.map((item) => (
            <Link key={item.href} href={item.href} className="admin-nav-link">
              <span className="material-icons">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User footer */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: '700',
              color: '#fff',
              flexShrink: 0,
            }}>
              {employe?.prenom?.[0] ?? user.email?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {employe ? `${employe.prenom} ${employe.nom}` : user.email}
              </div>
              <div style={{ fontSize: '11px', color: isAdmin ? '#a78bfa' : '#60a5fa', fontWeight: '600', textTransform: 'capitalize' }}>{role}</div>
            </div>
          </div>
          <Link href="/login" className="admin-logout-btn" style={{
            display: 'block',
            textAlign: 'center',
            padding: '7px',
            borderRadius: '6px',
            background: 'rgba(255,255,255,0.07)',
            color: 'rgba(255,255,255,0.55)',
            textDecoration: 'none',
            fontSize: '12px',
            fontWeight: '500',
          }}>
            → Déconnexion
          </Link>
        </div>
      </aside>

      {/* Main content area */}
      <div className="admin-main-content">
        {/* Top header */}
        <header style={{
          background: '#fff',
          borderBottom: '1px solid #e5e7eb',
          padding: '0 32px',
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}>
          <div style={{ fontSize: '15px', fontWeight: '600', color: '#1f2937' }}>
            WS Formation — Administration
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '13px', color: '#9ca3af' }}>{user.email}</span>
            <Link href="/login" style={{
              padding: '7px 16px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff',
              borderRadius: '7px',
              textDecoration: 'none',
              fontSize: '13px',
              fontWeight: '600',
            }}>
              Déconnexion
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: '32px' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
