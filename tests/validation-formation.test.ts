import { describe, it, expect } from 'vitest'
import { estValidateurPossible, peutEtrePubliee, statutDe } from '@/lib/validation-formation'

const f = { clinique: 'CMC', creee_par: 'createur' }
describe('validateurs possibles', () => {
  it('jamais le créateur ni le demandeur', () => {
    expect(estValidateurPossible({ id: 'createur', role: 'super_admin', clinique: null }, f)).toBe(false)
    expect(estValidateurPossible({ id: 'x', role: 'admin', clinique: 'CMC' }, f, 'x')).toBe(false)
  })
  it('admin de la bonne clinique, admin global, gestionnaire autorisé', () => {
    expect(estValidateurPossible({ id: 'a', role: 'admin', clinique: 'CMC' }, f, 'd')).toBe(true)
    expect(estValidateurPossible({ id: 'a', role: 'admin', clinique: 'WSSC' }, f, 'd')).toBe(false)
    expect(estValidateurPossible({ id: 's', role: 'super_admin', clinique: null }, f, 'd')).toBe(true)
    expect(estValidateurPossible({ id: 'g', role: 'gestionnaire', clinique: 'CMC', peut_valider_formations: true }, f, 'd')).toBe(true)
    expect(estValidateurPossible({ id: 'g', role: 'gestionnaire', clinique: 'CMC' }, f, 'd')).toBe(false)
    expect(estValidateurPossible({ id: 'e', role: 'employe', clinique: 'CMC' }, f, 'd')).toBe(false)
  })
  it('archivé : non', () => {
    expect(estValidateurPossible({ id: 'a', role: 'admin', clinique: 'CMC', actif: false }, f, 'd')).toBe(false)
  })
})

describe('publication', () => {
  const base = { id: '1', titre: 'T', clinique: 'CMC', publiee: false }
  it('seulement approuvée', () => {
    expect(peutEtrePubliee({ ...base, statut_validation: 'brouillon' })).toBe(false)
    expect(peutEtrePubliee({ ...base, statut_validation: 'en_validation' })).toBe(false)
    expect(peutEtrePubliee({ ...base, statut_validation: 'approuvee' })).toBe(true)
    expect(statutDe({ statut_validation: null })).toBe('brouillon')
  })
})
