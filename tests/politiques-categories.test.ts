import { describe, it, expect } from 'vitest'
import { parCategorie, normaliserCode, libelleCategorie, type CategoriePolitique } from '@/lib/politiques-categories'

const cat = (id: string, code: string, ordre: number): CategoriePolitique => ({ id, code, nom: code.toLowerCase(), emoji: null, departements: [], ordre })

describe('catégories de politiques', () => {
  it('normalise le code', () => {
    expect(normaliserCode(' méd-1 ')).toBe('MED1')
    expect(normaliserCode('consentementXYZ')).toBe('CONSENTE')
  })
  it('libellé', () => expect(libelleCategorie({ code: 'MED', nom: 'Médicaments' })).toBe('MED — Médicaments'))
  it('regroupe dans l’ordre, sans catégorie à la fin, groupes vides retirés', () => {
    const cats = [cat('a', 'MED', 1), cat('b', 'CHU', 2), cat('c', 'CON', 3)]
    const g = parCategorie([{ categorie_id: 'b' }, { categorie_id: null }, { categorie_id: 'a' }, { categorie_id: 'zzz' }], cats)
    expect(g.map(x => x.categorie?.code ?? '-')).toEqual(['MED', 'CHU', '-'])
    expect(g[2].politiques).toHaveLength(2)
  })
})
