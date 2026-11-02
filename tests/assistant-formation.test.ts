import { describe, it, expect } from 'vitest'
import { etapeValide, dureeTotale, aplatirLecons, type Brouillon } from '@/lib/assistant-formation'

const base: Brouillon = {
  titre: 'Hygiène', description: '', image: '', clinique: 'WSSC', categorie: 'X', niveau: 'debutant', objectifs: [],
  modules: [{ titre: 'M1', duree: 15, lecons: ['L1'] }],
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
    expect(etapeValide(base, 3)).toBe(true)
  })
  it('additionne les durées', () => {
    expect(dureeTotale({ modules: [{ titre: 'a', duree: 15, lecons: [] }, { titre: 'b', duree: 30, lecons: [] }] })).toBe(45)
  })
  it('met les leçons à plat dans l’ordre des modules', () => {
    const r = aplatirLecons([
      { titre: 'B', ordre: 2, lessons: [{ id: 'b1', titre: 'b1', ordre: 1, blocs: [] }] },
      { titre: 'A', ordre: 1, lessons: [{ id: 'a2', titre: 'a2', ordre: 2, blocs: [{}, {}] }, { id: 'a1', titre: 'a1', ordre: 1 }] },
    ])
    expect(r.map(l => l.id)).toEqual(['a1', 'a2', 'b1'])
    expect(r[1].nbBlocs).toBe(2)
  })
})
