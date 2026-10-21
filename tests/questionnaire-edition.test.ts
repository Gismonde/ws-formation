import { describe, it, expect } from 'vitest'
import { validerQuestionnaire } from '@/lib/questionnaire-edition'

const q = (texte: string, reponses: [string, boolean][]) => ({ texte, points: 1, reponses: reponses.map(([t, c]) => ({ texte: t, est_correcte: c })) })

describe('édition du questionnaire', () => {
  it('accepte un questionnaire valide et nettoie les réponses vides', () => {
    const r = validerQuestionnaire({ titre: 'Quiz', note_passage: 80, nb_tentatives_max: 3, questions: [q('Q1', [['Oui', true], ['Non', false], ['', false]])] })
    expect('valeurs' in r && r.valeurs.questions[0].reponses.length).toBe(2)
  })
  it('exige au moins une bonne réponse et deux réponses', () => {
    expect(validerQuestionnaire({ note_passage: 80, questions: [q('Q1', [['Oui', false], ['Non', false]])] })).toHaveProperty('erreur')
    expect(validerQuestionnaire({ note_passage: 80, questions: [q('Q1', [['Oui', true], ['Aussi', true], ['Non', false]])] })).toHaveProperty('valeurs')
    expect(validerQuestionnaire({ note_passage: 80, questions: [q('Q1', [['Oui', true]])] })).toHaveProperty('erreur')
    expect(validerQuestionnaire({ note_passage: 80, questions: [q('', [['Oui', true], ['Non', false]])] })).toHaveProperty('erreur')
  })
  it('contrôle le seuil et les tentatives (vide = illimité)', () => {
    expect(validerQuestionnaire({ note_passage: 0, questions: [] })).toHaveProperty('erreur')
    expect(validerQuestionnaire({ note_passage: 80, nb_tentatives_max: 0, questions: [] })).toHaveProperty('erreur')
    const r = validerQuestionnaire({ note_passage: 75, nb_tentatives_max: null, questions: [] })
    expect('valeurs' in r && r.valeurs.nb_tentatives_max).toBeNull()
  })
})
