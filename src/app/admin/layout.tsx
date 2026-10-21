import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActeur, peutCreerFormations } from '@/lib/permissions'
import { aAccesAdmin, estAdministrateur, ROLE_LABEL, cliniquesDe, CLINIQUE_INFO, THEME_CLINIQUE, vuesAdminPossibles } from '@/lib/cliniques'
import { ChoixVueAdmin } from '@/components/ChoixVueAdmin'
import { TiroirMenu } from '@/components/TiroirMenu'

const adminNav = [
  { href: '/admin', label: 'Dashboard', icon: 'dashboard' },
  { href: '/admin/employes', label: 'Employés', icon: 'people' },
  { href: '/admin/formations', label: 'Formations', icon: 'school' },
  { href: '/admin/assigner', label: 'Assigner en groupe', icon: 'assignment_ind' },
  { href: '/admin/librairie', label: 'Librairie', icon: 'video_library', createurs: true },
  { href: '/admin/conformite', label: 'Conformité', icon: 'verified' },
  { href: '/admin/rapports', label: 'Rapports', icon: 'bar_chart' },
  { href: '/admin/expirations', label: 'Expirations', icon: 'event_busy' },
  { href: '/admin/sondages', label: 'Sondages', icon: 'reviews' },
  { href: '/admin/departements', label: 'Départements', icon: 'apartment', adminOnly: true },
  { href: '/admin/politiques', label: 'Politiques', icon: 'policy' },
  { href: '/admin/sop', label: 'SOP', icon: 'description' },
  { href: '/admin/accueil', label: "Page d'accueil", icon: 'home', adminOnly: true },
  { href: '/admin/audit', label: 'Audit logs', icon: 'manage_search', adminOnly: true },
  { href: '/admin/employes/suppressions', label: 'Suppressions', icon: 'delete_forever', superAdmin: true },
  { href: '/admin/parametres', label: 'Paramètres', icon: 'settings', adminOnly: true },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const employe = await getActeur()
  if (!employe || !aAccesAdmin(employe.role)) redirect('/dashboard/accueil')

  const isAdmin = estAdministrateur(employe.role)
  const perimetre = employe.vue
    ? CLINIQUE_INFO[employe.vue].court
    : employe.role === 'super_admin'
      ? 'CMC + WSSC'
      : cliniquesDe(employe.clinique).map(c => CLINIQUE_INFO[c].court).join(' + ')
  // Une seule clinique (choisie ou unique) : la barre prend ses couleurs
  const cliniqueTheme = employe.vue ?? (cliniquesDe(employe.clinique).length === 1 && employe.role !== 'super_admin' ? cliniquesDe(employe.clinique)[0] : null)
  const fondBarre = cliniqueTheme ? THEME_CLINIQUE[cliniqueTheme].fondBarre : 'linear-gradient(180deg, #1a1f36 0%, #0d1117 100%)'
  const visibleNav = adminNav.filter(item => (!('adminOnly' in item) || !item.adminOnly || isAdmin) && (!('createurs' in item) || peutCreerFormations(employe)) && (!('superAdmin' in item) || employe.role === 'super_admin'))

  return (
    <div className='coque-adaptative' style={{ display: 'flex', minHeight: '100vh', background: '#f0f2f5' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @import url('https://fonts.googleapis.com/icon?family=Material+Icons');
        .admin-nav-link { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; color: rgba(255,255,255,0.65); text-decoration: none; font-size: 14px; font-weight: 500; margin-bottom: 2px; transition: all 0.15s ease; }
        .admin-nav-link:hover { background: rgba(255,255,255,0.1); color: #fff; }
        .admin-sidebar { width: 240px; color: #fff; display: flex; flex-direction: column; position: fixed; top: 0; left: 0; bottom: 0; z-index: 100; }
        .admin-main-content { margin-left: 240px; flex: 1; display: flex; flex-direction: column; min-height: 100vh; min-width: 0; }
        .admin-entete { background: #fff; border-bottom: 1px solid #e5e7eb; padding: 0 32px; height: 64px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 50; gap: 12px; }
        .admin-contenu { padding: 32px; flex: 1; }
        @media (max-width: 900px) {
          .admin-main-content { margin-left: 0; min-height: 0; }
          .admin-entete { display: none; }
          .admin-contenu { padding: 16px; }
        }
      `}</style>

      <TiroirMenu classe='admin-sidebar' fond={fondBarre} titre='WS Formation — Administration'>
        <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontWeight: '700', fontSize: '15px', color: '#fff' }}>WS Formation</div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
            Administration{cliniqueTheme ? ` — ${CLINIQUE_INFO[cliniqueTheme].nom}` : ''}
          </div>
          <ChoixVueAdmin vue={employe.vue ?? null} possibles={vuesAdminPossibles(employe.clinique, employe.role)} />
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
          <Link href='/dashboard/accueil' style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: '13px', marginBottom: '6px' }}>
            <span className='material-icons' style={{ fontSize: '16px' }}>person</span>
            Mon espace
          </Link>
          <form action='/api/auth/signout' method='POST'>
            <button type='submit' style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px', width: '100%' }}>
              <span className='material-icons' style={{ fontSize: '16px' }}>logout</span>
              Déconnexion
            </button>
          </form>
        </div>
      </TiroirMenu>

      <main className='admin-main-content'>
        <header className='admin-entete'>
          <div style={{ fontWeight: '600', fontSize: '16px', color: '#1a1f36' }}>WS Formation — Administration</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '14px', color: '#6b7280' }}>{user.email}</span>
            <form action='/api/auth/signout' method='POST'>
              <button type='submit' style={{ padding: '7px 16px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Déconnexion</button>
            </form>
          </div>
        </header>
        <div className='admin-contenu contenu-adaptatif'>{children}</div>
      </main>
    </div>
  )
}
