import { describe, it, expect, vi } from 'vitest'
vi.mock('@/lib/permissions', () => ({ idsEmployesDansPortee: async () => null }))
vi.mock('@/lib/conformite', () => ({ chargerConformite: async () => [] }))
import { reussiteParQuestion } from '@/lib/statistiques-formation'

describe('réussite par question', () => {
  it('calcule le taux et trie les plus difficiles en premier', () => {
    const r = reussiteParQuestion(
      [{ id: 'q1', texte: 'Facile', bonne: 'a' }, { id: 'q2', texte: 'Difficile', bonne: 'b' }],
      [{ reponses: { q1: 'a', q2: 'x' } }, { reponses: { q1: 'a', q2: 'b' } }, { reponses: { q1: 'c' } }],
    )
    expect(r.map(x => x.id)).toEqual(['q2', 'q1'])
    expect(r[0]).toMatchObject({ repondues: 2, taux: 50 })
    expect(r[1]).toMatchObject({ repondues: 3, taux: 67 })
  })
})
