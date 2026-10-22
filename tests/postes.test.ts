import { describe, it, expect } from 'vitest'
import { suggererPoste, parFamille } from '@/lib/postes'

const off = ['Chef infirmière', 'Infirmière', 'Infirmière de recherche', 'Gestionnaire de projet', 'Gestionnaire', 'Recherche']
describe('suggererPoste', () => {
  it('trouve le poste officiel le plus précis', () => {
    expect(suggererPoste('Chef Infirmière conval', off)).toBe('Chef infirmière')
    expect(suggererPoste('Infirmière de Recherche', off)).toBe('Infirmière de recherche')
    expect(suggererPoste('Gestionnaire de projet numérique', off)).toBe('Gestionnaire de projet')
    expect(suggererPoste('recherche', off)).toBe('Recherche')
    expect(suggererPoste('Plombier', off)).toBeNull()
  })
})
describe('parFamille', () => {
  it('regroupe dans l’ordre', () => {
    expect(parFamille([{ nom: 'A', famille: 'X' }, { nom: 'B', famille: 'Y' }, { nom: 'C', famille: 'X' }])).toEqual([{ famille: 'X', postes: ['A', 'C'] }, { famille: 'Y', postes: ['B'] }])
  })
})
