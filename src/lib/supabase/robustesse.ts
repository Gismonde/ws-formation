// Session Supabase côté serveur : une panne passagère du service d'authentification
// (réseau, 5xx, limite de requêtes) ne doit pas être prise pour une déconnexion.
// Avant, getUser() renvoyait alors « pas d'utilisateur » et la page redirigeait vers /login.

type ErreurAuth = { name?: string; status?: number; code?: string; message?: string } | null | undefined

/** L'erreur vient-elle d'un problème passager (à réessayer) plutôt que d'une session absente ou invalide ? */
export function erreurTransitoire(e: ErreurAuth): boolean {
  if (!e) return false
  if (e.name === 'AuthRetryableFetchError') return true
  if (e.name === 'AuthSessionMissingError') return false
  const s = e.status ?? 0
  return s === 0 && /fetch|network|timeout|ECONN|socket/i.test(e.message ?? '') || s === 408 || s === 429 || s >= 500
}

export class AuthIndisponible extends Error {
  constructor(public cause?: unknown) { super('Service d’authentification momentanément indisponible') }
}

const pause = (ms: number) => new Promise(r => setTimeout(r, ms))

/** Enveloppe auth.getUser : réessaie les erreurs passagères puis lève AuthIndisponible au lieu de « déconnecté ». */
export function getUserRobuste<R extends { error: ErreurAuth }>(getUser: () => Promise<R>, essais = 3): () => Promise<R> {
  return async () => {
    let r = await getUser()
    for (let i = 1; i < essais && erreurTransitoire(r.error); i++) {
      await pause(250 * i)
      r = await getUser()
    }
    if (erreurTransitoire(r.error)) {
      console.error('[auth] getUser indisponible', r.error?.status, r.error?.name, r.error?.message)
      throw new AuthIndisponible(r.error)
    }
    if (r.error && r.error.name !== 'AuthSessionMissingError') {
      // Session réellement invalide (jeton révoqué, déjà utilisé…) : tracé pour comprendre les déconnexions
      console.warn('[auth] session refusée', r.error.status, r.error.code, r.error.message)
    }
    return r
  }
}
