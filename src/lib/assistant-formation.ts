// Assistant de création de formation : données et règles de chaque étape (sans dépendance React).
import type { CliniqueContenu } from '@/lib/cliniques'

export type ModuleBrouillon = { titre: string; duree: number; lecons: string[] }
export type QuestionBrouillon = { texte: string; reponses: { texte: string; est_correcte: boolean }[] }
export type Brouillon = {
  titre: string; description: string; image: string
  clinique: CliniqueContenu | null; categorie: string; niveau: 'debutant' | 'intermediaire' | 'avance'; objectifs: string[]
  modules: ModuleBrouillon[]
  quiz: boolean; questions: QuestionBrouillon[]; seuil: number
}

/** Une question remplie est valide si au moins une bonne réponse a un texte. */
export function questionValide(q: QuestionBrouillon): boolean {
  return !q.texte.trim() || q.reponses.some(r => r.est_correcte && r.texte.trim())
}

/** L'étape peut-elle être quittée ? 0 idée · 1 public · 2 plan · 3 quiz · 4 résumé */
export function etapeValide(b: Brouillon, etape: number): boolean {
  switch (etape) {
    case 0: return !!b.titre.trim()
    case 1: return !!b.clinique
    case 2: return b.modules.length > 0 && b.modules.every(m => m.titre.trim() && m.duree > 0)
    case 3: return !b.quiz || b.questions.every(questionValide)
    default: return true
  }
}

/** Durée totale (minutes) = somme des durées des modules. */
export const dureeTotale = (b: Pick<Brouillon, 'modules'>) => b.modules.reduce((s, m) => s + (m.duree || 0), 0)
