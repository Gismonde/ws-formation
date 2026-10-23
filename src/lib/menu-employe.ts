// Menu du portail employé : 5 entrées, chacune avec ses onglets en haut de la page.
export type OngletEmploye = { href: string; label: string; emoji: string }
export type GroupeEmploye = { id: string; label: string; emoji: string; onglets: OngletEmploye[] }

export const MENU_EMPLOYE: GroupeEmploye[] = [
  { id: 'accueil', label: 'Accueil', emoji: '🏠', onglets: [{ href: '/dashboard/accueil', label: 'Accueil', emoji: '🏠' }] },
  { id: 'formations', label: 'Formations', emoji: '🎓', onglets: [
    { href: '/dashboard', label: 'Mes formations', emoji: '🎓' },
    { href: '/dashboard/evenements', label: 'Événements', emoji: '📅' },
    { href: '/dashboard/historique', label: 'Historique', emoji: '🕐' },
  ] },
  { id: 'reussites', label: 'Réussites', emoji: '🏆', onglets: [
    { href: '/dashboard/certificats', label: 'Mes certificats', emoji: '🏆' },
    { href: '/dashboard/badges', label: 'Mes badges', emoji: '🏅' },
    { href: '/dashboard/preuves', label: 'Mes preuves', emoji: '📎' },
  ] },
  { id: 'politiques', label: 'Politiques & SOP', emoji: '📜', onglets: [
    { href: '/dashboard/politiques', label: 'Politiques', emoji: '📜' },
    { href: '/dashboard/sop', label: 'Mes SOP', emoji: '📋' },
  ] },
  { id: 'compte', label: 'Mon compte', emoji: '👤', onglets: [
    { href: '/dashboard/profil', label: 'Profil', emoji: '👤' },
    { href: '/dashboard/securite', label: 'Sécurité', emoji: '🔐' },
  ] },
]

/** L'onglet correspond-il à cette adresse ? (« /dashboard » seulement exactement ; les autres aussi pour leurs sous-pages) */
export function correspond(href: string, chemin: string): boolean {
  if (href === '/dashboard') return chemin === '/dashboard'
  return chemin === href || chemin.startsWith(href + '/')
}

/** Groupe et onglet actifs pour une adresse (fonction pure, testée) */
export function groupeActif(chemin: string): { groupe: GroupeEmploye; onglet: OngletEmploye } | null {
  for (const groupe of MENU_EMPLOYE) {
    const onglet = groupe.onglets.find(o => correspond(o.href, chemin))
    if (onglet) return { groupe, onglet }
  }
  return null
}
