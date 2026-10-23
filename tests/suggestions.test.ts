import { describe, it, expect } from 'vitest'
import { lireSuggestion, peutTraiterSuggestion } from '@/lib/suggestions'

describe('suggestions', () => {
  it('valide le formulaire selon le type', () => {
    expect('erreur' in lireSuggestion({ type: 'formation', message: 'Très utile pour nous' })).toBe(true)
    expect('erreur' in lireSuggestion({ type: 'commentaire', message: 'Bien fait' })).toBe(true)
    const ok = lireSuggestion({ type: 'plateforme', message: 'Un mode sombre svp', anonyme: true })
    expect('valeurs' in ok && ok.valeurs.anonyme).toBe(true)
    expect('erreur' in lireSuggestion({ type: 'autre', message: 'xxxxxx' })).toBe(true)
  })
  it('idées plateforme : administrateur global seulement ; le reste : administrateurs de la clinique', () => {
    expect(peutTraiterSuggestion({ role: 'admin', clinique: 'CMC' } as never, { type: 'plateforme', clinique: 'CMC' })).toBe(false)
    expect(peutTraiterSuggestion({ role: 'super_admin', clinique: null } as never, { type: 'plateforme', clinique: 'CMC' })).toBe(true)
    expect(peutTraiterSuggestion({ role: 'admin', clinique: 'CMC' } as never, { type: 'formation', clinique: 'WSSC' })).toBe(false)
    expect(peutTraiterSuggestion({ role: 'admin', clinique: 'CMC' } as never, { type: 'formation', clinique: 'LES_DEUX' })).toBe(true)
    expect(peutTraiterSuggestion({ role: 'gestionnaire', clinique: 'CMC' } as never, { type: 'formation', clinique: 'CMC' })).toBe(false)
  })
})
