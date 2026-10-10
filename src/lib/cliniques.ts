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
