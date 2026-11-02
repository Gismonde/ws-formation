// Assistant de création de formation : données et règles de chaque étape (sans dépendance React).
import type { CliniqueContenu } from '@/lib/cliniques'

/** contenus[k] : texte importé de la leçon k (document), recopié en premier bloc. */
export type ModuleBrouillon = { titre: string; duree: number; lecons: string[]; contenu?: string; contenus?: string[] }
export type PointDepart = 'zero' | 'document' | 'presentation'
export type Brouillon = {
  titre: string; description: string; image: string
  clinique: CliniqueContenu | null; categorie: string; niveau: 'debutant' | 'intermediaire' | 'avance'; objectifs: string[]
  modules: ModuleBrouillon[]
}

/** L'étape peut-elle être quittée ? 0 idée · 1 public · 2 plan · 3 contenu · 4 quiz · 5 prêt */
export function etapeValide(b: Brouillon, etape: number): boolean {
  switch (etape) {
    case 0: return !!b.titre.trim()
    case 1: return !!b.clinique
    case 2: return b.modules.length > 0 && b.modules.every(m => m.titre.trim() && m.duree > 0)
    default: return true
  }
}

/** Durée totale (minutes) = somme des durées des modules. */
export const dureeTotale = (b: Pick<Brouillon, 'modules'>) => b.modules.reduce((s, m) => s + (m.duree || 0), 0)

/** Leçon vue par l'assistant (étape « Le contenu »). */
export type LeconAssistant = { id: string; titre: string; module: string; moduleOrdre: number; ordre: number; nbBlocs: number }

/** Aplatis modules → leçons, dans l'ordre. */
export function aplatirLecons(modules: { titre: string; ordre: number; lessons?: { id: string; titre: string; ordre: number; blocs?: unknown[] | null }[] | null }[]): LeconAssistant[] {
  return [...modules].sort((a, b) => a.ordre - b.ordre).flatMap(m =>
    [...(m.lessons ?? [])].sort((a, b) => a.ordre - b.ordre).map(l => ({ id: l.id, titre: l.titre, module: m.titre, moduleOrdre: m.ordre, ordre: l.ordre, nbBlocs: l.blocs?.length ?? 0 })))
}

/** Modules détectés dans un document → plan de l'assistant. */
export function planDepuisDocument(modules: { titre: string; contenu?: string; duree_minutes?: number; lecons?: { titre: string; description?: string }[] }[]): ModuleBrouillon[] {
  const r = modules.filter(m => m.titre?.trim()).map(m => {
    const lecons = (m.lecons ?? []).filter(l => l.titre?.trim())
    return {
      titre: m.titre.trim(), duree: Math.max(5, Math.round((m.duree_minutes || 15) / 5) * 5), contenu: m.contenu ?? '',
      lecons: lecons.length ? lecons.map(l => l.titre.trim()) : [m.titre.trim()],
      contenus: lecons.length ? lecons.map(l => l.description ?? '') : [m.contenu ?? ''],
    }
  })
  return r.length ? r : [{ titre: '', duree: 15, lecons: [''] }]
}
