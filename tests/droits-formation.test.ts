import { describe, it, expect, vi } from 'vitest'
vi.mock('@/lib/historique-formation', () => ({ formationDuModule: vi.fn(), formationDeLaLecon: vi.fn(), formationDuBloc: vi.fn() }))
import { peutModifierFormation } from '@/lib/droits-formation'
import { publicationPermise } from '@/lib/validation-formation'

const base = { cliniques: ['CMC'], clinique: 'CMC', departement_id: null }
const gest = { ...base, id: 'g1', role: 'gestionnaire', peut_creer_formations: true } as never
const admin = { ...base, id: 'a1', role: 'admin' } as never

describe('peutModifierFormation', () => {
  it('gestionnaire : seulement ses propres formations', () => {
    expect(peutModifierFormation(gest, { clinique: 'CMC', creee_par: 'g1' })).toBe(true)
    expect(peutModifierFormation(gest, { clinique: 'CMC', creee_par: 'autre' })).toBe(false)
    expect(peutModifierFormation(gest, { clinique: 'CMC', creee_par: null })).toBe(false)
  })
  it('administrateur : toutes les formations de sa clinique', () => {
    expect(peutModifierFormation(admin, { clinique: 'CMC', creee_par: 'autre' })).toBe(true)
  })
})

describe('publicationPermise', () => {
  const brouillon = { validation_requise: true, statut_validation: 'brouillon' } as never
  it('admin publie sans validation, gestionnaire non', () => {
    expect(publicationPermise({ role: 'admin' }, brouillon)).toBe(true)
    expect(publicationPermise({ role: 'gestionnaire' }, brouillon)).toBe(false)
  })
})
