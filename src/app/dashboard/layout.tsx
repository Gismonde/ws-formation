import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

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

  const { data: employe } = await supabase
    .from('employes')
    .select('id, nom, prenom, role')
    .eq('auth_user_id', user.id)
    .single()

  const role = employe?.role ?? 'employe'
  const isAdminOrManager = role === 'admin' || role === 'gestionnaire'

  return (
    <div className="flex min-h-screen bg-gray-100">
      <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons" />

      {/* Sidebar */}
      <aside className="fixed top-0 left-0 h-screen w-60 flex flex-col z-50" style={{ background: 'linear-gradient(180deg, #1a1f36 0%, #0d1117 100%)' }}>
        {/* Logo */}
        <div className="px-5 py-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="text-white font-bold text-lg">WS Formation</div>
          <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>Espace employe</div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2.5 py-3 overflow-y-auto">
          {employeNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg mb-0.5 text-sm font-medium transition-colors hover:bg-white/10"
              style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}
            >
              <span className="material-icons text-xl" style={{ opacity: 0.8 }}>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          {employe && (
            <div className="text-sm mb-3" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {employe.prenom} {employe.nom}
            </div>
          )}
          {isAdminOrManager && (
            <Link
              href="/admin"
              className="flex items-center gap-2 px-2.5 py-2 rounded-md text-sm font-medium mb-2"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.9)', textDecoration: 'none' }}
            >
              <span className="material-icons text-base">admin_panel_settings</span>
              Espace Admin
            </Link>
          )}
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="flex items-center gap-2 px-2.5 py-2 rounded-md text-sm font-medium w-full text-left"
              style={{ background: 'transparent', color: 'rgba(255,255,255,0.5)', border: 'none', cursor: 'pointer' }}
            >
              <span className="material-icons text-base">logout</span>
              Deconnexion
            </button>
          </form>
        </div>
      </aside>

      {/* Contenu principal */}
      <main className="flex-1 flex flex-col min-h-screen" style={{ marginLeft: '240px' }}>
        {children}
      </main>
    </div>
  )
}
