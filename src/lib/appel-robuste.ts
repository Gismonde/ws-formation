// Appels d'actions serveur depuis l'éditeur : une coupure réseau ou une erreur passagère du serveur
// (ex. 503) ne doit pas laisser l'écran bloqué sur « Sauvegarde… » sans rien enregistrer.
export type Resultat<T> = { success: true; data: T } | { success: false; error: string }

/** Appelle l'action ; en cas d'exception (réseau, 5xx), réessaie une fois, puis renvoie une erreur lisible. */
export async function appelRobuste<T>(fn: () => Promise<Resultat<T>>, essais = 2): Promise<Resultat<T>> {
  let derniere: unknown = null
  for (let i = 0; i < essais; i++) {
    try {
      return await fn()
    } catch (e) {
      derniere = e
      if (i < essais - 1) await new Promise(r => setTimeout(r, 800))
    }
  }
  const msg = derniere instanceof Error ? derniere.message : ''
  return { success: false, error: 'Enregistrement impossible pour le moment (connexion ou serveur). Réessayez dans quelques secondes.' + (msg ? ` (${msg.slice(0, 80)})` : '') }
}
