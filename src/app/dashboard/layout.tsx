import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CliniqueLogos } from '@/components/CliniqueBadge'
import { serviceClient } from '@/lib/permissions'
import { nombrePolitiquesEnAttente } from '@/lib/politiques'
import { nombreEvenementsAInscrire } from '@/lib/evenements'
import { aAccesAdmin } from '@/lib/cliniques'
import { getEspace } from '@/lib/espace'
import { ChoixEspace } from '@/components/ChoixEspace'
import { TiroirMenu } from '@/components/TiroirMenu'
import { ChoixLangue } from '@/components/ChoixLangue'
import { i18n } from '@/lib/i18n/serveur'
import { MenuEmploye, OngletsEmploye } from '@/components/NavEmploye'
import EnteteEmploye from '@/components/EnteteEmploye'
import { CLINIQUE_INFO, THEME_CLINIQUE, THEME_NEUTRE, variablesTheme } from '@/lib/cliniques'


export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: employe } = await supabase
    .from('employes')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  const espace = await getEspace(employe)
  const { t } = await i18n()
  const politiquesEnAttente = employe ? await nombrePolitiquesEnAttente(serviceClient(), employe, espace.actif) : 0
  const evenementsAInscrire = employe ? await nombreEvenementsAInscrire(serviceClient(), employe) : 0
  const compteurs = { '/dashboard/evenements': evenementsAInscrire, '/dashboard/politiques': politiquesEnAttente }
  // Gestionnaire sans droit : portail employé seulement (pas de lien vers l'admin)
  const isAdmin = !!employe && aAccesAdmin(employe)
  // Logo, nom et couleurs de l'espace actif (CMC ou WSSC)
  const cliniqueAffichee = espace.actif
  const theme = espace.actif ? THEME_CLINIQUE[espace.actif] : THEME_NEUTRE
  const displayName = employe?.prenom && employe?.nom
    ? employe.prenom + ' ' + employe.nom
    : (user.email?.split('@')[0] || t('Utilisateur'))

  return (
    <div className="dashboard-shell coque-adaptative">
      <TiroirMenu classe="dashboard-sidebar" fond={theme.fondBarre} titre={cliniqueAffichee ? `WS Formation — ${CLINIQUE_INFO[cliniqueAffichee].court}` : 'WS Formation'}>
        {theme.bande && <div aria-hidden style={{ height: '6px', background: theme.bande, flexShrink: 0 }} />}
        <div className="sidebar-brand">
          <div className="sidebar-title">WS Formation</div>
          <div className="sidebar-subtitle">
            {cliniqueAffichee ? `${t('Espace {clinique}', { clinique: CLINIQUE_INFO[cliniqueAffichee].court })} — ${CLINIQUE_INFO[cliniqueAffichee].nom}` : t('Espace employé')}
          </div>
          {cliniqueAffichee && (
            <div style={{ marginTop: '14px', background: '#fff', borderRadius: '8px', padding: '8px', display: 'flex', justifyContent: 'center' }}>
              <CliniqueLogos clinique={cliniqueAffichee} hauteur={34} />
            </div>
          )}
          <ChoixEspace actif={espace.actif} possibles={espace.possibles} />
          <div style={{ marginTop: '10px' }}><ChoixLangue sombre /></div>
        </div>

        <MenuEmploye compteurs={compteurs} />

        <div className="sidebar-footer">
          <div className="sidebar-user-info">
            <div className="sidebar-user-label">{t('Connecté en tant que')}</div>
            <div className="sidebar-user-name">{displayName}</div>
          </div>
          {isAdmin && (
            <Link href="/admin" className="sidebar-admin-btn">
              <span>⚙️</span>
              <span>{t('Espace Admin')}</span>
            </Link>
          )}
          <form action="/api/auth/signout" method="POST">
            <button type="submit" className="sidebar-logout-btn">
              <span>🚪</span>
              <span>{t('Déconnexion')}</span>
            </button>
          </form>
        </div>
      </TiroirMenu>

      <main className="dashboard-main contenu-adaptatif">
        <EnteteEmploye />
        <OngletsEmploye compteurs={compteurs} />
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
        .sidebar-nav { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 14px 10px; }
        .sidebar-brand, .sidebar-footer { flex-shrink: 0; }
        /* Écran peu haut (ordinateur portable) : en-tête et pied plus compacts, la déconnexion reste visible */
        @media (min-width: 901px) and (max-height: 820px) {
          .dashboard-sidebar { overflow: hidden; }
          .sidebar-brand { padding: 14px 16px 10px; }
          .sidebar-brand > div[style*="margin-top: 14px"] { margin-top: 8px !important; padding: 4px !important; }
          .sidebar-nav { padding: 8px 10px; }
          .sidebar-nav-item { padding: 8px 12px; }
          .sidebar-footer { padding: 8px 10px; }
          .sidebar-user-info { padding: 6px 12px; margin-bottom: 4px; }
        }
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
          display: flex; align-items: center; gap: 10px; width: 100%; background: transparent; border: none; cursor: pointer; font-family: inherit; text-align: left;
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
