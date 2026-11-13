import { describe, it, expect } from 'vitest'
import { sansLimiteSuggestions } from '@/lib/suggestions'

describe('limite hebdomadaire des suggestions', () => {
  it('Farah Malik n’a pas de limite', () => {
    expect(sansLimiteSuggestions({ email: 'malik.farah@wssurgical.com' })).toBe(true)
    expect(sansLimiteSuggestions({ email: ' Malik.Farah@WSSurgical.com ' })).toBe(true)
  })
  it('les autres employés gardent la limite', () => {
    expect(sansLimiteSuggestions({ email: 'grammont.cynthia@wssurgical.com' })).toBe(false)
    expect(sansLimiteSuggestions({ email: null })).toBe(false)
  })
})
