// Modèles de leçons prêts à remplir (créés en un clic dans l'éditeur).
import type { ContentBlockType } from '@/lib/types/formation'
import { donneesInitiales } from '@/lib/blocs-interactifs'

export type BlocModele = {
  type: ContentBlockType
  titre?: string | null
  contenu?: string | null
  url?: string | null
  metadata?: Record<string, unknown> | null
}

export type ModeleLecon = {
  id: string
  nom: string
  icone: string
  description: string
  /** Active « J'ai lu et compris » sur la leçon */
  attestation?: boolean
  blocs: BlocModele[]
  /** Modèle enregistré par l'équipe (table modeles_lecons) */
  perso?: { clinique: string; creePar: string | null; parMoi: boolean }
}

const quiz = (questions: { question: string; reponses: string[]; bonne_reponse: number; explication?: string }[]) =>
  JSON.stringify({ questions })

export const MODELES_LECON: ModeleLecon[] = [
  {
    id: 'introduction',
    nom: 'Introduction',
    icone: '🎯',
    description: 'Objectifs aux couleurs de la clinique, contexte, image',
    blocs: [
      { type: 'text', titre: 'Objectifs de la leçon', contenu: 'À la fin de cette leçon, vous serez capable de :\n- premier objectif\n- deuxième objectif\n- troisième objectif', metadata: { style: 'clinique' } },
      { type: 'text', titre: 'Pourquoi c’est important', contenu: 'Expliquez le contexte et l’impact pour les patients et l’équipe.' },
      { type: 'image', titre: 'Image d’accueil' },
    ],
  },
  {
    id: 'procedure',
    nom: 'Procédure (SOP)',
    icone: '✅',
    description: 'Objectif, étapes, vigilance, quiz',
    blocs: [
      { type: 'text', titre: 'Objectif', contenu: 'À la fin de cette leçon, vous saurez…', metadata: { style: 'clinique' } },
      { type: 'text', titre: 'Étapes à suivre', contenu: '1. Première étape\n2. Deuxième étape\n3. Troisième étape', metadata: { style: 'procedure' } },
      { type: 'text', titre: 'Points de vigilance', contenu: '- Erreur fréquente à éviter\n- Situation où il faut alerter', metadata: { style: 'attention' } },
      { type: 'video', titre: 'Démonstration' },
      { type: 'quiz', titre: 'Vérifiez vos connaissances', contenu: quiz([{ question: 'Quelle est la première étape ?', reponses: ['…', '…'], bonne_reponse: 0, explication: '' }]) },
    ],
  },
  {
    id: 'politique',
    nom: 'Politique interne',
    icone: '📜',
    description: 'Contexte, règles, document, attestation',
    attestation: true,
    blocs: [
      { type: 'text', titre: 'Contexte', contenu: 'Pourquoi cette politique existe et à qui elle s’applique.', metadata: { style: 'clinique' } },
      { type: 'text', titre: 'Ce qu’il faut retenir', contenu: '- Règle 1\n- Règle 2\n- Règle 3', metadata: { style: 'a_retenir' } },
      { type: 'file', titre: 'Document officiel de la politique' },
      { type: 'text', titre: 'En cas de non-respect', contenu: 'Conséquences et personne à contacter.', metadata: { style: 'attention' } },
    ],
  },
  {
    id: 'cas',
    nom: 'Cas pratique',
    icone: '🧩',
    description: 'Situation réelle, question, réponse expliquée',
    blocs: [
      { type: 'text', titre: 'La situation', contenu: 'Décrivez une situation réaliste vécue en clinique.', metadata: { style: 'clinique' } },
      { type: 'image', titre: 'Illustration de la situation' },
      { type: 'quiz', titre: 'Que feriez-vous ?', contenu: quiz([{ question: 'Quelle est la bonne réaction ?', reponses: ['Option A', 'Option B', 'Option C'], bonne_reponse: 0, explication: 'Expliquez pourquoi c’est la bonne réponse.' }]) },
      { type: 'text', titre: 'À retenir', contenu: 'La leçon principale de ce cas.', metadata: { style: 'a_retenir' } },
    ],
  },
  {
    id: 'mise_a_jour',
    nom: 'Mise à jour réglementaire',
    icone: '📢',
    description: 'Ce qui change, détails, attestation',
    attestation: true,
    blocs: [
      { type: 'text', titre: 'Ce qui change', contenu: 'Résumé du changement et date d’entrée en vigueur.', metadata: { style: 'attention' } },
      { type: 'text', titre: 'Détails', contenu: '- Avant : …\n- Maintenant : …' },
      { type: 'text', titre: 'Ce que vous devez faire', contenu: '1. …\n2. …', metadata: { style: 'procedure' } },
      { type: 'quiz', titre: 'Vérification', contenu: quiz([{ question: 'Depuis quand la nouvelle règle s’applique-t-elle ?', reponses: ['…', '…'], bonne_reponse: 0 }]) },
    ],
  },
  {
    id: 'video_commentee',
    nom: 'Vidéo commentée',
    icone: '🎬',
    description: 'Avant de regarder, vidéo, quiz',
    blocs: [
      { type: 'text', titre: 'Avant de regarder', contenu: 'Ce qu’il faut observer pendant la vidéo.', metadata: { style: 'clinique' } },
      { type: 'video', titre: 'Vidéo' },
      { type: 'quiz', titre: 'Avez-vous bien compris ?', contenu: quiz([{ question: 'Question sur la vidéo', reponses: ['…', '…'], bonne_reponse: 0 }]) },
    ],
  },
  {
    id: 'scenario',
    nom: 'Mise en situation',
    icone: '🧭',
    description: 'Situation, choix et conséquences, à retenir',
    blocs: [
      { type: 'text', titre: 'La situation', contenu: 'Décrivez une situation réaliste vécue à la clinique.', metadata: { style: 'clinique' } },
      { type: 'interactif', titre: 'Que faites-vous ?', metadata: { ...donneesInitiales('scenario') } },
      { type: 'text', titre: 'À retenir', contenu: '- La bonne pratique\n- Pourquoi', metadata: { style: 'a_retenir' } },
    ],
  },
  {
    id: 'recapitulatif',
    nom: 'Récapitulatif',
    icone: '🃏',
    description: 'Cartes de révision, puis quiz',
    blocs: [
      { type: 'text', titre: 'Ce que vous avez appris', contenu: 'Un dernier tour d’horizon avant le quiz.', metadata: { style: 'clinique' } },
      { type: 'interactif', titre: 'Révision', metadata: { ...donneesInitiales('cartes') } },
      { type: 'quiz', titre: 'Quiz de la leçon', contenu: quiz([{ question: '…', reponses: ['…', '…'], bonne_reponse: 0 }]) },
    ],
  },
]

/** Blocs d'une leçon → blocs d'un modèle (sans identifiants) */
export function blocsVersModele(blocs: { type: string; titre?: string | null; contenu?: string | null; url?: string | null; metadata?: unknown }[]): BlocModele[] {
  return blocs.map(b => ({
    type: b.type as ContentBlockType,
    titre: b.titre ?? null, contenu: b.contenu ?? null, url: b.url ?? null,
    metadata: b.metadata && typeof b.metadata === 'object' ? { ...(b.metadata as Record<string, unknown>) } : null,
  }))
}
