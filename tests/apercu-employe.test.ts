import { describe, it, expect, vi } from 'vitest'
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))
import { lireProgression, ecrireProgression } from '@/lib/apercu-employe'

describe('progression simulée du mode employé', () => {
  const a = '11111111-1111-1111-1111-111111111111', b = '22222222-2222-2222-2222-222222222222'
  it('lit et écrit sans doublon, ignore le reste', () => {
    expect(lireProgression(undefined)).toEqual([])
    expect(lireProgression(`${a}.pas-un-id.${b}`)).toEqual([a, b])
    expect(ecrireProgression([a, b, a])).toBe(`${a}.${b}`)
  })
})
