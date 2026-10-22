// Liste officielle des postes (table postes), regroupés par famille.
import type { SupabaseClient } from '@supabase/supabase-js'

export type Poste = { id: string; nom: string; famille: string; ordre: number; actif: boolean }

export const normPoste = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

export async function chargerPostes(sb: SupabaseClient, avecInactifs = false): Promise<Poste[]> {
  let q = sb.from('postes').select('id, nom, famille, ordre, actif')
  if (!avecInactifs) q = q.eq('actif', true)
  const { data, error } = await q
  if (error) return [] // table absente : migration pas encore exécutée
  return ((data ?? []) as Poste[]).sort((a, b) => a.famille.localeCompare(b.famille, 'fr') || a.ordre - b.ordre || a.nom.localeCompare(b.nom, 'fr'))
}

/** Postes groupés par famille, dans l'ordre. */
export function parFamille(postes: Pick<Poste, 'nom' | 'famille'>[]): { famille: string; postes: string[] }[] {
  const m = new Map<string, string[]>()
  for (const p of postes) m.set(p.famille, [...(m.get(p.famille) ?? []), p.nom])
  return Array.from(m, ([famille, noms]) => ({ famille, postes: noms }))
}

/** Poste officiel correspondant à un texte libre (même nom, ou nom officiel contenu dans le texte — le plus précis). */
export function suggererPoste(libre: string, officiels: string[]): string | null {
  const n = normPoste(libre)
  if (!n) return null
  const exact = officiels.find(o => normPoste(o) === n)
  if (exact) return exact
  const candidats = officiels
    .filter(o => { const on = normPoste(o); return (` ${n} `).includes(` ${on} `) || (` ${on} `).includes(` ${n} `) })
    .sort((a, b) => normPoste(b).length - normPoste(a).length)
  return candidats[0] ?? null
}
