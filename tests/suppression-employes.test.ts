import { describe, it, expect } from 'vitest'
import { lireRaison, peutSupprimerEmployes } from '@/lib/suppression-employes'

describe('suppression d’employés', () => {
  it('raison obligatoire d’au moins 10 caractères', () => {
    expect(lireRaison('erreur')).toBeNull()
    expect(lireRaison('   Créé par erreur   ')).toBe('Créé par erreur')
    expect(lireRaison(42)).toBeNull()
  })
  it('réservée aux administrateurs globaux', () => {
    expect(peutSupprimerEmployes(null)).toBe(false)
    expect(peutSupprimerEmployes({ role: 'admin' } as never)).toBe(false)
    expect(peutSupprimerEmployes({ role: 'super_admin' } as never)).toBe(true)
  })
})
