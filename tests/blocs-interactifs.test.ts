import { describe, it, expect } from 'vitest'
import { donneesInitiales, estComplet, refsMedias, scoreErreurs, dansZone, GENRES } from '@/lib/blocs-interactifs'

describe('blocs interactifs', () => {
  it('un bloc neuf est incomplet ; rempli, il est complet', () => {
    for (const g of GENRES) expect(estComplet(donneesInitiales(g.genre))).toBe(false)
    expect(estComplet({ genre: 'cartes', cartes: [{ recto: 'Q', verso: 'R' }] })).toBe(true)
    expect(estComplet({ genre: 'glisser', variante: 'ordonner', ordre: ['a', 'b'] })).toBe(true)
    expect(estComplet({ genre: 'erreurs', image: 'media:x', zones: [{ id: '1', x: 0, y: 0, l: 10, h: 10, titre: '', texte: '' }] })).toBe(true)
  })
  it('trouve les médias privés dans les données', () => {
    expect(refsMedias({ avant: 'media:a', etapes: [{ image: 'media:b' }, { image: 'https://x' }] })).toEqual(['media:a', 'media:b'])
  })
  it('score et zones', () => {
    expect(scoreErreurs(3, 3, 0)).toBe(100)
    expect(scoreErreurs(2, 4, 2)).toBe(40)
    expect(scoreErreurs(0, 3, 50)).toBe(0)
    expect(dansZone({ x: 10, y: 10, l: 20, h: 20 }, 15, 29)).toBe(true)
    expect(dansZone({ x: 10, y: 10, l: 20, h: 20 }, 31, 15)).toBe(false)
  })
})
