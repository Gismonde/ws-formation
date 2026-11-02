import { describe, it, expect } from 'vitest'
import { etapeValide, dureeTotale, type Brouillon } from '@/lib/assistant-formation'

const base: Brouillon = {
  titre: 'Hygiène', description: '', image: '', clinique: 'WSSC', categorie: 'X', niveau: 'debutant', objectifs: [],
  modules: [{ titre: 'M1', duree: 15, lecons: ['L1'] }], quiz: true,
  questions: [{ texte: 'Q', reponses: [{ texte: 'Oui', est_correcte: true }, { texte: 'Non', est_correcte: false }] }], seuil: 80,
}

describe('assistant de création', () => {
  it('exige un titre puis une clinique', () => {
    expect(etapeValide({ ...base, titre: '  ' }, 0)).toBe(false)
    expect(etapeValide({ ...base, clinique: null }, 1)).toBe(false)
    expect(etapeValide(base, 1)).toBe(true)
  })
  it('exige un titre pour chaque module', () => {
    expect(etapeValide({ ...base, modules: [{ titre: '', duree: 15, lecons: [] }] }, 2)).toBe(false)
    expect(etapeValide(base, 2)).toBe(true)
  })
  it('accepte un quiz vide ou reporté, refuse une question sans bonne réponse', () => {
    expect(etapeValide({ ...base, questions: [{ texte: 'Q', reponses: [{ texte: 'a', est_correcte: false }] }] }, 3)).toBe(false)
    expect(etapeValide({ ...base, quiz: false, questions: [{ texte: 'Q', reponses: [] }] }, 3)).toBe(true)
    expect(etapeValide({ ...base, questions: [{ texte: '', reponses: [] }] }, 3)).toBe(true)
  })
  it('additionne les durées', () => {
    expect(dureeTotale({ modules: [{ titre: 'a', duree: 15, lecons: [] }, { titre: 'b', duree: 30, lecons: [] }] })).toBe(45)
  })
})
