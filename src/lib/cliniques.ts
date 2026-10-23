// Constantes partagées (client + serveur) pour les cliniques et les rôles.

export type Clinique = 'CMC' | 'WSSC'
export type CliniqueEmploye = Clinique | 'LES_DEUX'
export type Role = 'super_admin' | 'admin' | 'gestionnaire' | 'employe'

export const CLINIQUES: Clinique[] = ['CMC', 'WSSC']

export const CLINIQUE_INFO: Record<Clinique, { nom: string; court: string; logo: string; couleur: string; fond: string; partenaires?: { logo: string; nom: string }[] }> = {
  CMC: { nom: 'Centre Métropolitain de Chirurgie', court: 'CMC', logo: '/logos/cmc.png', couleur: '#8a7a6b', fond: '#f5f1ec', partenaires: [{ logo: '/logos/grs-montreal.png', nom: 'GrS Montréal' }] },
  WSSC: { nom: 'Westmount Square Surgical Center', court: 'WSSC', logo: '/logos/wssc.png', couleur: '#1e3a6e', fond: '#eef2fa' },
}

/**
 * Clinique à afficher pour un employé : l'administrateur global, enregistré sans clinique (accès global),
 * couvre les deux cliniques. Sert à l'affichage et aux exports, pas aux contrôles d'accès.
 */
export function cliniqueAffichee(clinique: string | null | undefined, role: string | null | undefined): CliniqueEmploye | null {
  if (clinique === 'CMC' || clinique === 'WSSC' || clinique === 'LES_DEUX') return clinique
  return role === 'super_admin' ? 'LES_DEUX' : null
}

export const CLINIQUE_EMPLOYE_LABEL: Record<CliniqueEmploye, string> = {
  CMC: 'CMC',
  WSSC: 'WSSC',
  LES_DEUX: 'Les deux (CMC + WSSC)',
}

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: 'Administrateur global',
  admin: 'Administrateur de clinique',
  gestionnaire: 'Gestionnaire',
  employe: 'Employé',
}

/** Liste des cliniques couvertes par une valeur de clinique employé. */
export function cliniquesDe(c: string | null | undefined): Clinique[] {
  if (c === 'LES_DEUX') return ['CMC', 'WSSC']
  if (c === 'CMC' || c === 'WSSC') return [c]
  return []
}

export function estCliniqueEmploye(v: unknown): v is CliniqueEmploye {
  return v === 'CMC' || v === 'WSSC' || v === 'LES_DEUX'
}

export function estRole(v: unknown): v is Role {
  return v === 'super_admin' || v === 'admin' || v === 'gestionnaire' || v === 'employe'
}

export type DroitsGestionnaire = {
  role: string | null | undefined
  peut_creer_formations?: boolean | null
  peut_suivre_employes?: boolean | null
  peut_valider_formations?: boolean | null
  peut_creer_evenements?: boolean | null
}

/** Le gestionnaire a-t-il au moins un droit dans l'admin ? Sans droit, il n'a que le portail employé. */
export function gestionnaireAvecDroits(d: DroitsGestionnaire): boolean {
  return d.role === 'gestionnaire' && !!(d.peut_creer_formations || d.peut_suivre_employes || d.peut_valider_formations || d.peut_creer_evenements)
}

/**
 * Accès à l'espace Admin. Administrateurs : toujours.
 * Gestionnaires : seulement avec au moins un droit (passer la personne, pas seulement son rôle).
 * Avec un rôle seul (chaîne), un gestionnaire est considéré sans droit.
 */
export function aAccesAdmin(x: string | null | undefined | DroitsGestionnaire): boolean {
  const d: DroitsGestionnaire = typeof x === 'object' && x !== null ? x : { role: x as string | null | undefined }
  return d.role === 'super_admin' || d.role === 'admin' || gestionnaireAvecDroits(d)
}

/** Administrateur (global ou de clinique). */
export function estAdministrateur(role: string | null | undefined): boolean {
  return role === 'super_admin' || role === 'admin'
}

// ---------------------------------------------------------------------------
// Contenus (formations, SOP) rattachés à une clinique
// ---------------------------------------------------------------------------

/** Clinique d'un contenu : une seule clinique, ou commun aux deux. */
export type CliniqueContenu = Clinique | 'LES_DEUX'

export const CLINIQUE_CONTENU_LABEL: Record<CliniqueContenu, string> = {
  CMC: 'CMC seulement',
  WSSC: 'WSSC seulement',
  LES_DEUX: 'Les deux cliniques',
}

export function estCliniqueContenu(v: unknown): v is CliniqueContenu {
  return v === 'CMC' || v === 'WSSC' || v === 'LES_DEUX'
}

/**
 * Valeurs de « clinique » de contenu visibles dans un espace donné.
 * Espace CMC → contenus CMC + communs ; espace null (aucune clinique) → contenus communs seulement.
 */
export function cliniquesContenuDeLEspace(espace: Clinique | null): CliniqueContenu[] {
  return espace ? [espace, 'LES_DEUX'] : ['LES_DEUX']
}

// ---------------------------------------------------------------------------
// Espace employé (CMC / WSSC) et thème visuel
// ---------------------------------------------------------------------------

/** Cookie de la vue de l'espace Admin (CMC, WSSC ; absent = les deux). */
export const VUE_ADMIN_COOKIE = 'ws_vue_admin'

/** Vues Admin possibles : seulement pour l'équipe rattachée aux deux cliniques (ou l'admin global). */
export function vuesAdminPossibles(cliniqueEmploye: string | null | undefined, role: string | null | undefined): Clinique[] {
  if (role === 'super_admin') return ['CMC', 'WSSC']
  if (role !== 'admin' && role !== 'gestionnaire') return []
  const cl = cliniquesDe(cliniqueEmploye)
  return cl.length > 1 ? cl : []
}

/** Cookie qui mémorise l'espace choisi par un employé rattaché aux deux cliniques. */
export const ESPACE_COOKIE = 'ws_espace'

/**
 * Espace actif d'un employé.
 *  - Employé d'une seule clinique : toujours cette clinique.
 *  - Employé des deux cliniques (ou admin global) : l'espace choisi (cookie), CMC par défaut.
 *  - Employé sans clinique : aucun espace (contenus communs seulement).
 */
export function espaceActif(cliniqueEmploye: string | null | undefined, role: string | null | undefined, choix: string | null | undefined): Clinique | null {
  const possibles = espacesPossibles(cliniqueEmploye, role)
  if (possibles.length === 0) return null
  if (possibles.length === 1) return possibles[0]
  return choix === 'CMC' || choix === 'WSSC' ? choix : 'CMC'
}

/** Espaces qu'un employé peut ouvrir. L'admin global (sans clinique) a accès aux deux. */
export function espacesPossibles(cliniqueEmploye: string | null | undefined, role: string | null | undefined): Clinique[] {
  if (!cliniqueEmploye && role === 'super_admin') return ['CMC', 'WSSC']
  return cliniquesDe(cliniqueEmploye)
}

export type ThemeClinique = {
  /** Dégradé de la barre latérale */
  fondBarre: string
  /** Couleur d'accent (boutons, liens actifs, barres de progression) */
  accent: string
  /** Accent plus foncé (survol, textes sur fond clair) */
  accentFonce: string
  /** Fond très clair de l'accent (badges, encadrés) */
  accentClair: string
  /** Dégradé des vignettes de formation */
  degrade: string
  /** Fond clair de la zone principale */
  fondPage: string
}

export const THEME_CLINIQUE: Record<Clinique, ThemeClinique> = {
  CMC: {
    fondBarre: 'linear-gradient(160deg, #8a7a6b 0%, #5e5246 55%, #3b332b 100%)',
    accent: '#8a7a6b',
    accentFonce: '#5e5246',
    accentClair: '#f3eee8',
    degrade: 'linear-gradient(135deg, #a8988a 0%, #6f6154 100%)',
    fondPage: '#faf8f5',
  },
  WSSC: {
    fondBarre: 'linear-gradient(160deg, #1e3a6e 0%, #142a52 55%, #0b1a36 100%)',
    accent: '#1e3a6e',
    accentFonce: '#142a52',
    accentClair: '#e8eef8',
    degrade: 'linear-gradient(135deg, #3a5ea0 0%, #1e3a6e 100%)',
    fondPage: '#f5f7fc',
  },
}

/** Thème neutre (employé sans clinique). */
export const THEME_NEUTRE: ThemeClinique = {
  fondBarre: 'linear-gradient(160deg, #1e3a5f 0%, #0d2137 50%, #111827 100%)',
  accent: '#4f46e5',
  accentFonce: '#3730a3',
  accentClair: '#eef2ff',
  degrade: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  fondPage: '#f8fafc',
}

/** Variables CSS du thème, utilisées par toutes les pages de l'espace employé. */
export function variablesTheme(t: ThemeClinique): Record<string, string> {
  return {
    '--accent-clinique': t.accent,
    '--accent-clinique-fonce': t.accentFonce,
    '--accent-clinique-clair': t.accentClair,
    '--degrade-clinique': t.degrade,
    '--fond-clinique': t.fondPage,
    '--barre-clinique': t.fondBarre,
  }
}
