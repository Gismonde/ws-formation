import { describe, it, expect } from 'vitest'
import { badgesPaliers } from '@/lib/badges'

describe('badges de palier', () => {
  it('aucun badge sans formation terminée', () => {
    expect(badgesPaliers(0).filter(b => b.obtenu)).toHaveLength(0)
  })
  it('6 formations : 1 et 5 obtenus, progression vers 10', () => {
    const b = badgesPaliers(6)
    expect(b.filter(x => x.obtenu).map(x => x.id)).toEqual(['palier:1', 'palier:5'])
    expect(b.find(x => x.id === 'palier:10')?.progression).toEqual({ fait: 6, total: 10 })
    expect(b.find(x => x.id === 'palier:1')?.progression).toEqual({ fait: 1, total: 1 })
  })
})
