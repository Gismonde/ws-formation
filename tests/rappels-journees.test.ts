import { describe, it, expect } from 'vitest'
import { politiquesRestantes } from '@/lib/rappels-journees'

const P = (id: string, version = 1, o: Partial<{ actif: boolean; brouillon: boolean }> = {}) => ({ id, titre: id.toUpperCase(), version, actif: o.actif ?? true, brouillon: o.brouillon ?? false })

describe('Rappels des journées de formation', () => {
  const pols = new Map([['a', P('a')], ['b', P('b', 2)], ['c', P('c', 1, { brouillon: true })], ['d', P('d', 1, { actif: false })]])
  it('liste les politiques pas encore confirmées dans leur version en vigueur', () => {
    expect(politiquesRestantes(['a', 'b', 'c', 'd'], pols, new Set(['a:1', 'b:1'])).map(p => p.id)).toEqual(['b'])
  })
  it('rien à rappeler quand tout est confirmé', () => {
    expect(politiquesRestantes(['a', 'b'], pols, new Set(['a:1', 'b:2']))).toEqual([])
  })
})
