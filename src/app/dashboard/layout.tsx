import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CliniqueLogos } from '@/components/CliniqueBadge'
import { serviceClient } from '@/lib/permissions'
import { nombrePolitiquesEnAttente } from '@/lib/politiques'
import { getEspace } from '@/lib/espace'
import { ChoixEspace } from '@/components/ChoixEspace'
import { TiroirMenu } from '@/components/TiroirMenu'
import { CLINIQUE_INFO, THEME_CLINIQUE, THEME_NEUTRE, variablesTheme } from '@/lib/cliniques'

const employeNav = [
  { href: '/dashboard/accueil', label: 'Accueil', emoji: '🏠' },
  { href: '/dashboard', label: 'Mes formations', emoji: '🎓' },
  { href: '/dashboard/certificats', label: 'Mes certificats', emoji: '🏆' },
  { href: '/dashboard/politiques', label: 'Politiques', emoji: '📜' },
  { href: '/dashboard/sop', label: 'Mes SOP', emoji: '📋' },
  { href: '/dashboard/historique', label: 'Historique', emoji: '🕐' },
  { href: '/dashboard/preuves', label: 'Mes preuves', emoji: '📎' },
  { href: '/dashboard/profil', label: 'Profil', emoji: '👤' },
  { href: '/dashboard/securite', label: 'Sécurité', emoji: '🔐' },
]

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: employe } = await supabase
    .from('employes')
    .select('id, nom, prenom, role, clinique, departement_id')
    .eq('auth_user_id', user.id)
    .single()

  const espace = await getEspace(employe)
  const politiquesEnAttente = employe ? await nombrePolitiquesEnAttente(serviceClient(), employe, espace.actif) : 0
  const isAdmin = ['super_admin', 'admin', 'gestionnaire'].includes(employe?.role ?? '')
  // Logo, nom et couleurs de l'espace actif (CMC ou WSSC)
  const cliniqueAffichee = espace.actif
  const theme = espace.actif ? THEME_CLINIQUE[espace.actif] : THEME_NEUTRE
  const displayName = employe?.prenom && employe?.nom
    ? employe.prenom + ' ' + employe.nom
    : (user.email?.split('@')[0] || 'Utilisateur')

  return (
    <div className="dashboard-shell coque-adaptative">
      <TiroirMenu classe="dashboard-sidebar" fond={theme.fondBarre} titre={cliniqueAffichee ? `WS Formation — ${CLINIQUE_INFO[cliniqueAffichee].court}` : 'WS Formation'}>
        <div className="sidebar-brand">
          <div className="sidebar-title">WS Formation</div>
          <div className="sidebar-subtitle">
            {cliniqueAffichee ? `Espace ${CLINIQUE_INFO[cliniqueAffichee].court} — ${CLINIQUE_INFO[cliniqueAffichee].nom}` : 'Espace employé'}
          </div>
          {cliniqueAffichee && (
            <div style={{ marginTop: '14px', background: '#fff', borderRadius: '8px', padding: '8px', display: 'flex', justifyContent: 'center' }}>
              <CliniqueLogos clinique={cliniqueAffichee} hauteur={34} />
            </div>
          )}
          <ChoixEspace actif={espace.actif} possibles={espace.possibles} />
        </div>

        <nav className="sidebar-nav">
          {employeNav.map((item) => (
            <Link key={item.href} href={item.href} className="sidebar-nav-item">
              <span className="sidebar-emoji">{item.emoji}</span>
              <span>{item.label}</span>
              {item.href === '/dashboard/politiques' && politiquesEnAttente > 0 && (
                <span style={{ marginLeft: 'auto', background: '#f59e0b', color: '#fff', fontSize: '11px', fontWeight: 700, borderRadius: '999px', padding: '1px 7px' }}>{politiquesEnAttente}</span>
              )}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user-info">
            <div className="sidebar-user-label">Connecté en tant que</div>
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
            <span>Déconnexion</span>
          </Link>
        </div>
      </TiroirMenu>

      <main className="dashboard-main contenu-adaptatif">
        {children}
      </main>

      <style>{`
        .dashboard-shell { display: flex; min-height: 100vh; font-family: Inter, system-ui, sans-serif; }
        .dashboard-sidebar {
          width: 260px; min-width: 260px;
          background: ${theme.fondBarre};
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
        .sidebar-nav-item:hover { background: rgba(255,255,255,0.12); color: #ffffff; }
        .dashboard-shell { ${Object.entries(variablesTheme(theme)).map(([k, v]) => `${k}: ${v};`).join(' ')} }
        .dashboard-main .bg-indigo-600, .dashboard-main .bg-blue-600 { background-color: var(--accent-clinique) !important; }
        .dashboard-main .text-indigo-600, .dashboard-main .text-blue-600, .dashboard-main .text-indigo-700 { color: var(--accent-clinique) !important; }
        .dashboard-main .bg-indigo-50, .dashboard-main .bg-blue-50 { background-color: var(--accent-clinique-clair) !important; }
        .sidebar-emoji { font-size: 18px; width: 26px; text-align: center; }
        .sidebar-footer { padding: 14px 10px; border-top: 1px solid rgba(255,255,255,0.07); }
        .sidebar-user-info { padding: 11px 13px; border-radius: 10px; background: rgba(255,255,255,0.06); margin-bottom: 8px; }
        .sidebar-user-label { color: rgba(255,255,255,0.4); font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
        .sidebar-user-name { color: #ffffff; font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px; }
        .sidebar-admin-btn {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 13px; border-radius: 10px; margin-bottom: 4px;
          background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.25);
          color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 600;
        }
        .sidebar-admin-btn:hover { opacity: 0.88; }
        .sidebar-logout-btn {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 13px; border-radius: 10px;
          color: rgba(255,255,255,0.45); text-decoration: none; font-size: 13px;
        }
        .sidebar-logout-btn:hover { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.7); }
        .dashboard-main { flex: 1; background: ${theme.fondPage}; min-height: 100vh; overflow-y: auto; padding: 32px; min-width: 0; }
        @media (max-width: 900px) { .dashboard-main { padding: 16px; min-height: 0; overflow-y: visible; } }
      `}</style>
    </div>
  )
}
