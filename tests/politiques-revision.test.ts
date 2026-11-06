import { describe, it, expect } from 'vitest'
import { joursAvantRevision, estBrouillon } from '@/lib/politiques'

describe('Politiques : révision et brouillon', () => {
  const jour = new Date('2026-11-06T15:00:00Z')
  it('compte les jours avant la date de révision', () => {
    expect(joursAvantRevision({ date_revision: '2026-12-06' }, jour)).toBe(30)
    expect(joursAvantRevision({ date_revision: '2026-11-06' }, jour)).toBe(0)
    expect(joursAvantRevision({ date_revision: '2026-11-01' }, jour)).toBe(-5)
    expect(joursAvantRevision({ date_revision: null }, jour)).toBeNull()
  })
  it('reconnaît un brouillon', () => {
    expect(estBrouillon({ brouillon: true })).toBe(true)
    expect(estBrouillon({ brouillon: false })).toBe(false)
    expect(estBrouillon({})).toBe(false)
  })
})
