import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

const adminNav = [
  { href: '/admin', label: 'Dashboard', icon: '📊' },
  { href: '/admin/employes', label: 'Employés', icon: '👥' },
  { href: '/admin/formations', label: 'Formations', icon: '📚' },
  { href: '/admin/conformite', label: 'Conformité', icon: '✅' },
  { href: '/admin/rapports', label: 'Rapports', icon: '📈' },
  { href: '/admin/sop', label: 'SOP', icon: '📄' },
  { href: '/admin/audit', label: 'Audit logs', icon: '🔍', adminOnly: true },
  { href: '/admin/parametres', label: 'Paramètres', icon: '⚙️', adminOnly: true },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Try to find employe by auth_user_id first
  let { data: employe } = await supabase
    .from('employes')
    .select('role, prenom, nom')
    .eq('auth_user_id', user.id)
    .single()

  // Fallback: if not found by auth_user_id, try by email and auto-link
  if (!employe && user.email) {
    const { data: employeByEmail } = await supabase
      .from('employes')
      .select('role, prenom, nom, id, departement_id')
      .eq('email', user.email)
      .single()

    if (employeByEmail) {
      // Auto-link the auth user to the employe record
      await supabase
        .from('employes')
        .update({ auth_user_id: user.id })
        .eq('id', employeByEmail.id)
      employe = employeByEmail
    }
  }

  if (!employe || !['admin','gestionnaire'].includes(employe.role)) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col fixed h-full z-10">
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-600 rounded-md flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">WS</span>
            </div>
            <span className="font-semibold text-gray-900 text-sm">WS Formation</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <ul className="space-y-0.5">
            {adminNav.filter((link) => !link.adminOnly || employe.role === 'admin').map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors group"
                >
                  <span className="text-base w-5 text-center">{link.icon}</span>
                  <span>{link.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="px-4 py-4 border-t border-gray-100">
          <p className="text-xs text-gray-500 truncate">{employe.prenom} {employe.nom}</p>
          <p className="text-xs text-indigo-500 font-medium capitalize mt-0.5">{employe.role}</p>
          <Link href="/api/auth/signout" className="text-xs text-gray-400 hover:text-gray-700 mt-2 inline-block">
            → Déconnexion
          </Link>
        </div>
      </aside>

      <div className="flex-1 ml-60 min-h-screen">
        {children}
      </div>
    </div>
  )
}
