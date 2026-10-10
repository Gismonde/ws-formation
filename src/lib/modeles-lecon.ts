// Modèles de leçons prêts à remplir (créés en un clic dans l'éditeur).
import type { ContentBlockType } from '@/lib/types/formation'

type BlocModele = {
  type: ContentBlockType
  titre?: string
  contenu?: string
  metadata?: Record<string, unknown>
}

export type ModeleLecon = {
  id: string
  nom: string
  icone: string
  description: string
  /** Active « J'ai lu et compris » sur la leçon */
  attestation?: boolean
  blocs: BlocModele[]
}

const quiz = (questions: { question: string; reponses: string[]; bonne_reponse: number; explication?: string }[]) =>
  JSON.stringify({ questions })

export const MODELES_LECON: ModeleLecon[] = [
  {
    id: 'procedure',
    nom: 'Procédure (SOP)',
    icone: '✅',
    description: 'Objectif, étapes, vigilance, quiz',
    blocs: [
      { type: 'text', titre: 'Objectif', contenu: 'À la fin de cette leçon, vous saurez…' },
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
      { type: 'text', titre: 'Contexte', contenu: 'Pourquoi cette politique existe et à qui elle s’applique.' },
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
      { type: 'text', titre: 'La situation', contenu: 'Décrivez une situation réaliste vécue en clinique.' },
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
]
