// =====================================================
// TYPES - Architecture formation ws-formation
// Course → Modules → Lessons → Content Blocks
// =====================================================

// ---------------------------------------------------
// ENUMS
// ---------------------------------------------------

export type NiveauFormation = 'debutant' | 'intermediaire' | 'avance'

export type ContentBlockType = 'text' | 'video' | 'quiz' | 'slide' | 'file' | 'image'

export type StatutProgression = 'non_commence' | 'en_cours' | 'termine'

// ---------------------------------------------------
// FORMATION (Course)
// Table existante : formations
// ---------------------------------------------------

export interface Formation {
  id: string
    titre: string
      description: string | null
        categorie: string | null
          niveau: NiveauFormation | null
            duree_estimee_minutes: number | null
              publiee: boolean
                created_at: string
                  // Relations optionnelles (via select)
                    modules?: Module[]
                    }

                    // ---------------------------------------------------
                    // MODULE
                    // Table existante : modules
                    // Un cours contient plusieurs modules
                    // ---------------------------------------------------

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
                                        created_at: string | null
                                          // Relations optionnelles (via select)
                                            lessons?: Lesson[]
                                              formation?: Formation
                                              }

                                              // ---------------------------------------------------
                                              // LESSON
                                              // Table : lessons
                                              // Un module contient plusieurs leçons
                                              // ---------------------------------------------------

                                              export interface Lesson {
                                                id: string
                                                  module_id: string
                                                    titre: string
                                                      description: string | null
                                                        ordre: number
                                                          duree_minutes: number | null
                                                            est_obligatoire: boolean
                                                              created_at: string | null
                                                                updated_at: string | null
                                                                  // Relations optionnelles (via select)
                                                                    content_blocks?: ContentBlock[]
                                                                      module?: Module
                                                                      }

                                                                      // ---------------------------------------------------
                                                                      // CONTENT BLOCK
                                                                      // Table : content_blocks
                                                                      // Une leçon contient des blocs de contenu
                                                                      // ---------------------------------------------------

                                                                      /** Metadata pour un bloc de type quiz */
                                                                      export interface QuizMetadata {
                                                                        questions: {
                                                                            id: string
                                                                                texte: string
                                                                                    type: 'choix_unique' | 'choix_multiple' | 'vrai_faux'
                                                                                        options: { id: string; texte: string; est_correct: boolean }[]
                                                                                            explication?: string
                                                                                              }[]
                                                                                                seuil_reussite?: number // pourcentage min pour valider
                                                                                                }

                                                                                                /** Metadata pour un bloc de type slide */
                                                                                                export interface SlideMetadata {
                                                                                                  slides: {
                                                                                                      id: string
                                                                                                          titre?: string
                                                                                                              contenu: string
                                                                                                                  image_url?: string
                                                                                                                    }[]
                                                                                                                    }
                                                                                                                    
                                                                                                                    /** Metadata pour un bloc de type video */
                                                                                                                    export interface VideoMetadata {
                                                                                                                      duree_secondes?: number
                                                                                                                        provider?: 'youtube' | 'vimeo' | 'custom'
                                                                                                                          thumbnail_url?: string
                                                                                                                          }
                                                                                                                          
                                                                                                                          export type ContentBlockMetadata = QuizMetadata | SlideMetadata | VideoMetadata | Record<string, unknown>
                                                                                                                          
                                                                                                                          export interface ContentBlock {
                                                                                                                            id: string
                                                                                                                              lesson_id: string
                                                                                                                                type: ContentBlockType
                                                                                                                                  ordre: number
                                                                                                                                    titre: string | null
                                                                                                                                      contenu: string | null   // Texte markdown pour type='text'
                                                                                                                                        url: string | null       // URL pour type='video' | 'file'
                                                                                                                                          metadata: ContentBlockMetadata | null
                                                                                                                                            est_requis: boolean
                                                                                                                                              created_at: string | null
                                                                                                                                                updated_at: string | null
                                                                                                                                                  // Relations optionnelles (via select)
                                                                                                                                                    lesson?: Lesson
                                                                                                                                                    }
                                                                                                                                                    
                                                                                                                                                    // ---------------------------------------------------
                                                                                                                                                    // PROGRESSIONS
                                                                                                                                                    // ---------------------------------------------------
                                                                                                                                                    
                                                                                                                                                    /** Progression d'un employé sur un module (table existante) */
                                                                                                                                                    export interface Progression {
                                                                                                                                                      id: string
                                                                                                                                                        employe_id: string
                                                                                                                                                          module_id: string | null
                                                                                                                                                            statut: StatutProgression | null
                                                                                                                                                              pourcentage_complete: number | null
                                                                                                                                                                date_debut: string | null
                                                                                                                                                                  date_fin: string | null
                                                                                                                                                                    updated_at: string | null
                                                                                                                                                                    }
                                                                                                                                                                    
                                                                                                                                                                    /** Progression d'un employé sur une leçon (nouvelle table) */
                                                                                                                                                                    export interface LessonProgression {
                                                                                                                                                                      id: string
                                                                                                                                                                        employe_id: string
                                                                                                                                                                          lesson_id: string
                                                                                                                                                                            statut: StatutProgression
                                                                                                                                                                              pourcentage_complete: number
                                                                                                                                                                                date_debut: string | null
                                                                                                                                                                                  date_fin: string | null
                                                                                                                                                                                    updated_at: string | null
                                                                                                                                                                                    }
                                                                                                                                                                                    
                                                                                                                                                                                    // ---------------------------------------------------
                                                                                                                                                                                    // VUES ENRICHIES (pour l'UI)
                                                                                                                                                                                    // ---------------------------------------------------
                                                                                                                                                                                    
                                                                                                                                                                                    /** Formation avec sa hiérarchie complète */
                                                                                                                                                                                    export interface FormationComplete extends Formation {
                                                                                                                                                                                      modules: ModuleComplet[]
                                                                                                                                                                                      }
                                                                                                                                                                                      
                                                                                                                                                                                      /** Module avec ses leçons et progression */
                                                                                                                                                                                      export interface ModuleComplet extends Module {
                                                                                                                                                                                        lessons: LessonAvecBlocs[]
                                                                                                                                                                                          progression?: Progression
                                                                                                                                                                                          }
                                                                                                                                                                                          
                                                                                                                                                                                          /** Leçon avec ses blocs de contenu et progression */
                                                                                                                                                                                          export interface LessonAvecBlocs extends Lesson {
                                                                                                                                                                                            content_blocks: ContentBlock[]
                                                                                                                                                                                              progression?: LessonProgression
                                                                                                                                                                                              }
                                                                                                                                                                                              
                                                                                                                                                                                              /** Résumé de progression pour l'affichage */
                                                                                                                                                                                              export interface ProgressionResume {
                                                                                                                                                                                                formation_id: string
                                                                                                                                                                                                  formation_titre: string
                                                                                                                                                                                                    total_modules: number
                                                                                                                                                                                                      modules_termines: number
                                                                                                                                                                                                        total_lessons: number
                                                                                                                                                                                                          lessons_terminees: number
                                                                                                                                                                                                            pourcentage_global: number
                                                                                                                                                                                                            }
                                                                                                                                                                                                            
