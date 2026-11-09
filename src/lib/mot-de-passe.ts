// Règles communes des mots de passe du portail (même règle partout).
export const MDP_MIN = 10

export function regleMotDePasse(pwd: string): string | null {
  if (pwd.length < MDP_MIN) return `Le mot de passe doit contenir au moins ${MDP_MIN} caractères.`
  if (!/[A-Z]/.test(pwd)) return 'Le mot de passe doit contenir au moins une lettre majuscule.'
  if (!/[a-z]/.test(pwd)) return 'Le mot de passe doit contenir au moins une lettre minuscule.'
  if (!/[0-9]/.test(pwd)) return 'Le mot de passe doit contenir au moins un chiffre.'
  return null
}

/** L'utilisateur doit-il remplacer un mot de passe défini par un administrateur ? */
export function mdpTemporaire(user: { app_metadata?: Record<string, unknown> | null } | null | undefined): boolean {
  return user?.app_metadata?.mdp_temporaire === true
}

/** Pages accessibles tant que le mot de passe temporaire n'est pas remplacé. */
export const CHEMINS_MDP_TEMPORAIRE = ['/dashboard/securite', '/login', '/bienvenue', '/confidentialite', '/mfa-verify']
