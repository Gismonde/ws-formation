// Types TypeScript - Architecture ws-formation
// Course -> Modules -> Lessons -> Content Blocks

export type NiveauFormation = 'debutant' | 'intermediaire' | 'avance'
export type ContentBlockType = 'text' | 'video' | 'quiz' | 'slide' | 'file' | 'image'
export type StatutProgression = 'non_commence' | 'en_cours' | 'termine'

// FORMATION
export interface Formation {
  id: string
  titre: string
  description: string | null
  categorie: string | null
  niveau: NiveauFormation | null
  duree_estimee_minutes: number | null
  publiee: boolean
  created_at: string
}

// MODULE
export interface Module {
  id: string
  formation_id: string
  titre: string
  description: string | null
  contenu: string | null
  video_url: string | null
  fichier_url: string | null
  ordre: number
  duree_minutes: number | null
  created_at: string
}

// LESSON
export interface Lesson {
  id: string
  module_id: string
  titre: string
  description: string | null
  ordre: number
  duree_minutes: number | null
  obligatoire: boolean
  created_at: string
}

// CONTENT BLOCK
export interface ContentBlock {
  id: string
  lesson_id: string
  type: ContentBlockType
  titre: string | null
  contenu: string | null
  url: string | null
  metadata: Record<string, unknown> | null
  ordre: number
  created_at: string
  updated_at: string
}

// PROGRESSION
export interface Progression {
  id: string
  employe_id: string
  formation_id: string
  statut: StatutProgression
  progression_pct: number
  date_debut: string | null
  date_fin: string | null
}

export interface LessonProgression {
  id: string
  employe_id: string
  lesson_id: string
  statut: StatutProgression
  date_debut: string | null
  date_completion: string | null
  temps_passe_minutes: number
}

// VUES ENRICHIES

export interface FormationComplete extends Formation {
  modules: Module[]
}

export interface ModuleComplet extends Module {
  lessons: Lesson[]
}

export interface LessonAvecBlocs extends Lesson {
  blocs: ContentBlock[]
}

export interface ProgressionResume {
  formation_id: string
  titre: string
  statut: StatutProgression
  progression_pct: number
  modules_total: number
  modules_termines: number
  lessons_total: number
  lessons_terminees: number
}
