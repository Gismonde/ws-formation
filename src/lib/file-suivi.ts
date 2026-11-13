// File d'attente du suivi hors ligne : vidéos vues, attestations et leçons terminées sans réseau,
// envoyées au serveur dès le retour de la connexion (/api/suivi/rattrapage).
export type ActionSuivi = { type: 'video' | 'attestation' | 'terminer'; id: string; le: string }
const CLE = 'ws_file_suivi'

export function lireFile(): ActionSuivi[] {
  try { const v = JSON.parse(localStorage.getItem(CLE) ?? '[]'); return Array.isArray(v) ? v : [] } catch { return [] }
}
function ecrire(l: ActionSuivi[]) {
  try { localStorage.setItem(CLE, JSON.stringify(l)) } catch { /* stockage indisponible */ }
  try { window.dispatchEvent(new Event('ws-file-suivi')) } catch { /* */ }
}
export function ajouterAFile(a: Omit<ActionSuivi, 'le'>) {
  const l = lireFile()
  if (!l.some(x => x.type === a.type && x.id === a.id)) ecrire([...l, { ...a, le: new Date().toISOString() }])
}
export const horsLigne = () => typeof navigator !== 'undefined' && navigator.onLine === false

/** Action de suivi envoyée tout de suite par une route stable. null = réseau ou serveur injoignable. */
export async function envoyerSuivi<T = string>(type: ActionSuivi['type'], id: string): Promise<{ ok: true; data?: T } | { ok: false; erreur: string; manquants?: string[] } | null> {
  try {
    const r = await fetch('/api/suivi/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, id }) })
    if (r.status >= 500) return null
    return await r.json()
  } catch { return null }
}

/** Envoie la file ; garde ce qui n'a pas pu partir. */
export async function viderFile(): Promise<number> {
  const l = lireFile()
  if (!l.length || horsLigne()) return 0
  try {
    const r = await fetch('/api/suivi/rattrapage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actions: l }) })
    if (!r.ok) return 0
    const d = await r.json() as { restantes?: ActionSuivi[] }
    ecrire(d.restantes ?? [])
    return l.length - (d.restantes?.length ?? 0)
  } catch { return 0 }
}
