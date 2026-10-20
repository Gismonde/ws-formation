import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActeur } from '@/lib/permissions'
import { aAccesAdmin, estAdministrateur, ROLE_LABEL, cliniquesDe, CLINIQUE_INFO } from '@/lib/cliniques'

const adminNav = [
  { href: '/admin', label: 'Dashboard', icon: 'dashboard' },
  { href: '/admin/employes', label: 'Employes', icon: 'people' },
  { href: '/admin/formations', label: 'Formations', icon: 'school' },
  { href: '/admin/conformite', label: 'Conformite', icon: 'verified' },
  { href: '/admin/rapports', label: 'Rapports', icon: 'bar_chart' },
  { href: '/admin/expirations', label: 'Expirations', icon: 'event_busy' },
  { href: '/admin/departements', label: 'Departements', icon: 'apartment', adminOnly: true },
  { href: '/admin/politiques', label: 'Politiques', icon: 'policy' },
  { href: '/admin/sop', label: 'SOP', icon: 'description' },
  { href: '/admin/audit', label: 'Audit logs', icon: 'manage_search', adminOnly: true },
  { href: '/admin/parametres', label: 'Parametres', icon: 'settings', adminOnly: true },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const employe = await getActeur()
  if (!employe || !aAccesAdmin(employe.role)) redirect('/dashboard')

  const isAdmin = estAdministrateur(employe.role)
  const perimetre = employe.role === 'super_admin'
    ? 'CMC + WSSC'
    : cliniquesDe(employe.clinique).map(c => CLINIQUE_INFO[c].court).join(' + ')
  const visibleNav = adminNav.filter(item => !item.adminOnly || isAdmin)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f0f2f5' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @import url('https://fonts.googleapis.com/icon?family=Material+Icons');
        .admin-nav-link { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; color: rgba(255,255,255,0.65); text-decoration: none; font-size: 14px; font-weight: 500; margin-bottom: 2px; transition: all 0.15s ease; }
        .admin-nav-link:hover { background: rgba(255,255,255,0.1); color: #fff; }
        .admin-main-content { margin-left: 240px; flex: 1; display: flex; flex-direction: column; min-height: 100vh; }
      `}</style>

      <aside style={{ width: '240px', background: 'linear-gradient(180deg, #1a1f36 0%, #0d1117 100%)', color: '#fff', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100 }}>
        <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontWeight: '700', fontSize: '15px', color: '#fff' }}>WS Formation</div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Administration</div>
        </div>

        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          {visibleNav.map((item) => (
            <Link key={item.href} href={item.href} className='admin-nav-link'>
              <span className='material-icons' style={{ fontSize: '18px' }}>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          {employe && (
            <div style={{ marginBottom: '12px', fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
              {employe.prenom} {employe.nom}
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '2px' }}>
                {ROLE_LABEL[employe.role]}{perimetre ? ' · ' + perimetre : ''}
              </div>
            </div>
          )}
          <Link href='/dashboard' style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: '13px', marginBottom: '6px' }}>
            <span className='material-icons' style={{ fontSize: '16px' }}>person</span>
            Mon espace
          </Link>
          <form action='/api/auth/signout' method='POST'>
            <button type='submit' style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px', width: '100%' }}>
              <span className='material-icons' style={{ fontSize: '16px' }}>logout</span>
              Deconnexion
            </button>
          </form>
        </div>
      </aside>

      <main className='admin-main-content'>
        <header style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 32px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
          <div style={{ fontWeight: '600', fontSize: '16px', color: '#1a1f36' }}>WS Formation — Administration</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '14px', color: '#6b7280' }}>{user.email}</span>
            <form action='/api/auth/signout' method='POST'>
              <button type='submit' style={{ padding: '7px 16px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Deconnexion</button>
            </form>
          </div>
        </header>
        <div style={{ padding: '32px', flex: 1 }}>{children}</div>
      </main>
    </div>
  )
        }
