import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

const employeNav = [
  { href: '/dashboard', label: 'Mes formations', emoji: '🎓' },
  { href: '/dashboard/certificats', label: 'Mes certificats', emoji: '🏆' },
  { href: '/dashboard/sop', label: 'Mes SOP', emoji: '📋' },
  { href: '/dashboard/historique', label: 'Historique', emoji: '🕐' },
  { href: '/dashboard/profil', label: 'Profil', emoji: '👤' },
]

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: employe } = await supabase
    .from('employes')
    .select('id, nom, prenom, role')
    .eq('auth_user_id', user.id)
    .single()

  const isAdmin = employe?.role === 'admin' || employe?.role === 'super_admin'
  const displayName = employe?.prenom && employe?.nom
    ? employe.prenom + ' ' + employe.nom
    : (user.email?.split('@')[0] || 'Utilisateur')

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-title">WS Formation</div>
          <div className="sidebar-subtitle">Espace employe</div>
        </div>

        <nav className="sidebar-nav">
          {employeNav.map((item) => (
            <Link key={item.href} href={item.href} className="sidebar-nav-item">
              <span className="sidebar-emoji">{item.emoji}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user-info">
            <div className="sidebar-user-label">Connecte en tant que</div>
            <div className="sidebar-user-name">{displayName}</div>
          </div>
          {isAdmin && (
            <Link href="/admin" className="sidebar-admin-btn">
              <span>⚙️</span>
              <span>Espace Admin</span>
            </Link>
          )}
          <Link href="/logout" className="sidebar-logout-btn">
            <span>🚪</span>
            <span>Deconnexion</span>
          </Link>
        </div>
      </aside>

      <main className="dashboard-main">
        {children}
      </main>

      <style>{`
        .dashboard-shell { display: flex; min-height: 100vh; font-family: Inter, system-ui, sans-serif; }
        .dashboard-sidebar {
          width: 260px; min-width: 260px;
          background: linear-gradient(160deg, #1e3a5f 0%, #0d2137 50%, #111827 100%);
          display: flex; flex-direction: column;
          box-shadow: 4px 0 24px rgba(0,0,0,0.4);
          position: sticky; top: 0; height: 100vh; overflow-y: auto;
        }
        .sidebar-brand { padding: 24px 20px 18px; border-bottom: 1px solid rgba(255,255,255,0.07); }
        .sidebar-title { color: #ffffff; font-size: 17px; font-weight: 700; }
        .sidebar-subtitle { color: rgba(255,255,255,0.45); font-size: 12px; margin-top: 2px; }
        .sidebar-nav { flex: 1; padding: 14px 10px; }
        .sidebar-nav-item {
          display: flex; align-items: center; gap: 12px;
          padding: 11px 13px; border-radius: 10px; margin-bottom: 3px;
          color: rgba(255,255,255,0.78); text-decoration: none;
          font-size: 14px; font-weight: 500;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .sidebar-nav-item:hover { background: rgba(255,255,255,0.1); color: #ffffff; }
        .sidebar-emoji { font-size: 18px; width: 26px; text-align: center; }
        .sidebar-footer { padding: 14px 10px; border-top: 1px solid rgba(255,255,255,0.07); }
        .sidebar-user-info { padding: 11px 13px; border-radius: 10px; background: rgba(255,255,255,0.06); margin-bottom: 8px; }
        .sidebar-user-label { color: rgba(255,255,255,0.4); font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
        .sidebar-user-name { color: #ffffff; font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px; }
        .sidebar-admin-btn {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 13px; border-radius: 10px; margin-bottom: 4px;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 600;
        }
        .sidebar-admin-btn:hover { opacity: 0.88; }
        .sidebar-logout-btn {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 13px; border-radius: 10px;
          color: rgba(255,255,255,0.45); text-decoration: none; font-size: 13px;
        }
        .sidebar-logout-btn:hover { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.7); }
        .dashboard-main { flex: 1; background: #f8fafc; min-height: 100vh; overflow-y: auto; }
      `}</style>
    </div>
  )
}
