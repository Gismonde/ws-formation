import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActeur, peutCreerFormations, peutSuivreEmployes, peutValiderFormations, peutCreerEvenements } from '@/lib/permissions'
import { aAccesAdmin, estAdministrateur, ROLE_LABEL, cliniquesDe, CLINIQUE_INFO, THEME_CLINIQUE, vuesAdminPossibles } from '@/lib/cliniques'
import { ChoixVueAdmin } from '@/components/ChoixVueAdmin'
import { TiroirMenu } from '@/components/TiroirMenu'
import { ChoixLangue } from '@/components/ChoixLangue'
import { RechercheGlobale } from '@/components/RechercheGlobale'
import { MenuAdmin, type GroupeMenu } from '@/components/MenuAdmin'
import { DEUX_FACTEURS_ADMIN_OBLIGATOIRE } from '@/lib/securite'
import { i18n } from '@/lib/i18n/serveur'

type Droit = 'suivi' | 'formations' | 'validation' | 'evenements'
/** droits : il suffit d'en avoir un (les administrateurs les ont tous) */
type EntreeNav = { href: string; label: string; icon: string; adminOnly?: boolean; createurs?: boolean; superAdmin?: boolean; droits?: Droit[] }
const adminNav: { id: string; label: string; icon: string; liens: EntreeNav[] }[] = [
  { id: 'accueil', label: 'Tableau de bord', icon: 'dashboard', liens: [{ href: '/admin', label: 'Tableau de bord', icon: 'dashboard' }] },
  { id: 'employes', label: 'Employés', icon: 'people', liens: [
    { href: '/admin/employes', label: 'Employés', icon: 'people', droits: ['suivi'] },
    { href: '/admin/departements', label: 'Départements', icon: 'apartment', adminOnly: true },
    { href: '/admin/employes/suppressions', label: 'Suppressions', icon: 'delete_forever', superAdmin: true },
  ] },
  { id: 'contenus', label: 'Formations & politiques', icon: 'school', liens: [
    { href: '/admin/formations', label: 'Formations', icon: 'school', droits: ['formations', 'suivi', 'validation'] },
    { href: '/admin/formations/a-valider', label: 'À valider', icon: 'fact_check', droits: ['validation', 'formations'] },
    { href: '/admin/librairie', label: 'Librairie', icon: 'video_library', createurs: true },
    { href: '/admin/journees', label: 'Journées de formation', icon: 'event_available', droits: ['suivi'] },
    { href: '/admin/assigner', label: 'Assigner en groupe', icon: 'assignment_ind', droits: ['suivi'] },
    { href: '/admin/politiques', label: 'Politiques', icon: 'policy', droits: ['suivi'] },
    { href: '/admin/sop', label: 'SOP', icon: 'description', adminOnly: true },
  ] },
  { id: 'suivi', label: 'Suivi & conformité', icon: 'verified', liens: [
    { href: '/admin/conformite', label: 'Conformité', icon: 'verified', droits: ['suivi'] },
    { href: '/admin/expirations', label: 'Expirations', icon: 'event_busy', droits: ['suivi'] },
    { href: '/admin/rapports', label: 'Rapports', icon: 'bar_chart', droits: ['suivi'] },
    { href: '/admin/sondages', label: 'Sondages', icon: 'reviews', droits: ['suivi', 'formations'] },
  ] },
  { id: 'administration', label: 'Administration', icon: 'settings', liens: [
    { href: '/admin/accueil', label: "Page d'accueil", icon: 'home', adminOnly: true },
    { href: '/admin/audit', label: 'Audit logs', icon: 'manage_search', adminOnly: true },
    { href: '/admin/parametres', label: 'Paramètres', icon: 'settings', adminOnly: true },
  ] },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const employe = await getActeur()
  const { t } = await i18n()
  if (!employe || !aAccesAdmin(employe)) redirect('/dashboard/accueil')
  // Double authentification des administrateurs : rappel tant qu'elle n'est pas activée,
  // puis blocage quand DEUX_FACTEURS_ADMIN_OBLIGATOIRE est activé
  let rappel2fa = false
  if (estAdministrateur(employe.role)) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aal?.nextLevel !== 'aal2') {
      if (DEUX_FACTEURS_ADMIN_OBLIGATOIRE) redirect('/dashboard/securite?obligatoire=1')
      rappel2fa = true
    }
  }

  const isAdmin = estAdministrateur(employe.role)
  const perimetre = employe.vue
    ? CLINIQUE_INFO[employe.vue].court
    : employe.role === 'super_admin'
      ? 'CMC + WSSC'
      : cliniquesDe(employe.clinique).map(c => CLINIQUE_INFO[c].court).join(' + ')
  // Une seule clinique (choisie ou unique) : la barre prend ses couleurs
  const cliniqueTheme = employe.vue ?? (cliniquesDe(employe.clinique).length === 1 && employe.role !== 'super_admin' ? cliniquesDe(employe.clinique)[0] : null)
  const fondBarre = cliniqueTheme ? THEME_CLINIQUE[cliniqueTheme].fondBarre : 'linear-gradient(180deg, #1a1f36 0%, #0d1117 100%)'
  const droits: Record<Droit, boolean> = {
    suivi: peutSuivreEmployes(employe), formations: peutCreerFormations(employe),
    validation: peutValiderFormations(employe), evenements: peutCreerEvenements(employe),
  }
  const visible = (l: EntreeNav) => (!l.adminOnly || isAdmin) && (!l.createurs || peutCreerFormations(employe)) && (!l.superAdmin || employe.role === 'super_admin')
    && (!l.droits || l.droits.some(d => droits[d]))
  const groupes: GroupeMenu[] = adminNav
    .map(g => ({ id: g.id, label: t(g.label), icon: g.icon, liens: g.liens.filter(visible).map(l => ({ href: l.href, label: t(l.label), icon: l.icon })) }))
    .filter(g => g.liens.length > 0)

  return (
    <div className='coque-adaptative' style={{ display: 'flex', minHeight: '100vh', background: '#f0f2f5' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @import url('https://fonts.googleapis.com/icon?family=Material+Icons');
        .admin-nav-link { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; color: rgba(255,255,255,0.65); text-decoration: none; font-size: 14px; font-weight: 500; margin-bottom: 2px; transition: all 0.15s ease; }
        .admin-nav-link:hover { background: rgba(255,255,255,0.1); color: #fff; }
        .admin-nav-groupe { width: 100%; background: none; border: none; cursor: pointer; font-family: inherit; }
        .admin-nav-sous { padding: 7px 10px; font-size: 13px; }
        .admin-nav-link.actif { background: rgba(255,255,255,0.14); color: #fff; }
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
          <div style={{ fontWeight: '700', fontSize: '15px', color: '#fff' }}>{t('WS Formation')}</div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
            {t('Administration')}{cliniqueTheme ? ` — ${CLINIQUE_INFO[cliniqueTheme].nom}` : ''}
          </div>
          <ChoixVueAdmin vue={employe.vue ?? null} possibles={vuesAdminPossibles(employe.clinique, employe.role)} />
        </div>

        <MenuAdmin groupes={groupes} />

        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div className='langue-tiroir' style={{ marginBottom: '12px' }}><ChoixLangue sombre /></div>
          {employe && (
            <div style={{ marginBottom: '12px', fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
              {employe.prenom} {employe.nom}
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '2px' }}>
                {t(ROLE_LABEL[employe.role])}{perimetre ? ' · ' + perimetre : ''}
              </div>
            </div>
          )}
          <Link href='/dashboard/accueil' style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: '13px', marginBottom: '6px' }}>
            <span className='material-icons' style={{ fontSize: '16px' }}>person</span>
            {t('Mon espace')}
          </Link>
          <form action='/api/auth/signout' method='POST'>
            <button type='submit' style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px', width: '100%' }}>
              <span className='material-icons' style={{ fontSize: '16px' }}>logout</span>
              {t('Déconnexion')}
            </button>
          </form>
        </div>
      </TiroirMenu>

      <main className='admin-main-content'>
        <header className='admin-entete'>
          <div style={{ fontWeight: '600', fontSize: '16px', color: '#1a1f36', whiteSpace: 'nowrap' }}>{t('WS Formation — Administration')}</div>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}><RechercheGlobale /></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <ChoixLangue />
            <span style={{ fontSize: '14px', color: '#6b7280' }}>{user.email}</span>
            <form action='/api/auth/signout' method='POST'>
              <button type='submit' style={{ padding: '7px 16px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>{t('Déconnexion')}</button>
            </form>
          </div>
        </header>
        <div className='admin-contenu contenu-adaptatif'>
          {rappel2fa && (
            <div style={{ marginBottom: '20px', padding: '12px 16px', borderRadius: '10px', background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontSize: '14px' }}>
              🛡️ <strong>{t('Activez la double authentification.')}</strong>{' '}{t('Elle sera bientôt obligatoire pour les administrateurs.')}{' '}
              <Link href='/dashboard/securite?obligatoire=1' style={{ fontWeight: 600, color: 'inherit' }}>{t('L’activer maintenant →')}</Link>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  )
}
