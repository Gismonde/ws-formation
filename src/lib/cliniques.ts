// Constantes partagées (client + serveur) pour les cliniques et les rôles.

export type Clinique = 'CMC' | 'WSSC'
export type CliniqueEmploye = Clinique | 'LES_DEUX'
export type Role = 'super_admin' | 'admin' | 'gestionnaire' | 'employe'

export const CLINIQUES: Clinique[] = ['CMC', 'WSSC']

export const CLINIQUE_INFO: Record<Clinique, { nom: string; court: string; logo: string; couleur: string; fond: string }> = {
  CMC: { nom: 'Complexe Chirurgical CMC', court: 'CMC', logo: '/logos/cmc.png', couleur: '#8a7a6b', fond: '#f5f1ec' },
  WSSC: { nom: 'Westmount Square Surgical Center', court: 'WSSC', logo: '/logos/wssc.png', couleur: '#1e3a6e', fond: '#eef2fa' },
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

/** Accès à l'espace Admin (gestion des formations, équipe, rapports). */
export function aAccesAdmin(role: string | null | undefined): boolean {
  return role === 'super_admin' || role === 'admin' || role === 'gestionnaire'
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
  /** Couleur d'accent (boutons, liens actifs) */
  accent: string
  /** Fond clair de la zone principale */
  fondPage: string
}

export const THEME_CLINIQUE: Record<Clinique, ThemeClinique> = {
  CMC: {
    fondBarre: 'linear-gradient(160deg, #8a7a6b 0%, #5e5246 55%, #3b332b 100%)',
    accent: '#8a7a6b',
    fondPage: '#faf8f5',
  },
  WSSC: {
    fondBarre: 'linear-gradient(160deg, #1e3a6e 0%, #142a52 55%, #0b1a36 100%)',
    accent: '#1e3a6e',
    fondPage: '#f5f7fc',
  },
}

/** Thème neutre (employé sans clinique). */
export const THEME_NEUTRE: ThemeClinique = {
  fondBarre: 'linear-gradient(160deg, #1e3a5f 0%, #0d2137 50%, #111827 100%)',
  accent: '#2563eb',
  fondPage: '#f8fafc',
}
