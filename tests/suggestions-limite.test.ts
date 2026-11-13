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

import { peutTraiterSuggestion, peutAssignerA } from '@/lib/suggestions'
describe('assignation des suggestions', () => {
  const idee = { type: 'plateforme', clinique: 'WSSC' } as const
  const cmc = { type: 'formation', clinique: 'CMC' } as const
  const adminWssc = { id: 'a1', role: 'admin', clinique: 'WSSC', actif: true } as never
  it('l’administrateur global peut assigner une idée plateforme ou une autre clinique à n’importe quel admin', () => {
    expect(peutAssignerA({ role: 'super_admin' }, adminWssc, idee as never)).toBe(true)
    expect(peutAssignerA({ role: 'super_admin' }, adminWssc, cmc as never)).toBe(true)
  })
  it('l’admin assigné voit et traite la suggestion', () => {
    expect(peutTraiterSuggestion(adminWssc, idee as never)).toBe(false)
    expect(peutTraiterSuggestion(adminWssc, { ...idee, assigne_a: 'a1' } as never)).toBe(true)
  })
  it('un admin de clinique n’assigne qu’à ceux qui peuvent la traiter ; jamais à un employé ou inactif', () => {
    expect(peutAssignerA({ role: 'admin' }, adminWssc, idee as never)).toBe(false)
    expect(peutAssignerA({ role: 'super_admin' }, { id: 'e', role: 'employe', clinique: 'WSSC' } as never, idee as never)).toBe(false)
    expect(peutAssignerA({ role: 'super_admin' }, { ...(adminWssc as object), actif: false } as never, idee as never)).toBe(false)
  })
})
