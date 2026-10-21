import { describe, it, expect } from 'vitest'
import { lireJournee } from '@/lib/journees'

const F = '11111111-1111-4111-8111-111111111111'
const E = '22222222-2222-4222-8222-222222222222'

describe('journées de formation', () => {
  it('modèle : raison et contenu requis, pas d’employés', () => {
    const r = lireJournee({ modele: true, raison: 'Embauche', clinique: 'CMC', formation_ids: [F], employe_ids: [E] }, ['CMC'])
    expect('valeurs' in r && r.valeurs.employe_ids).toEqual([])
    expect('valeurs' in r && r.valeurs.nom).toBe('Embauche')
    expect(lireJournee({ modele: true, raison: '', clinique: 'CMC', formation_ids: [F] }, ['CMC'])).toHaveProperty('erreur')
    expect(lireJournee({ modele: true, raison: 'Embauche', clinique: 'CMC' }, ['CMC'])).toHaveProperty('erreur')
  })
  it('journée lancée : au moins un employé, clinique permise', () => {
    expect(lireJournee({ raison: 'Embauche', clinique: 'CMC', formation_ids: [F] }, ['CMC'])).toHaveProperty('erreur')
    expect(lireJournee({ raison: 'Embauche', clinique: 'WSSC', formation_ids: [F], employe_ids: [E] }, ['CMC'])).toHaveProperty('erreur')
    const r = lireJournee({ raison: 'Embauche', clinique: 'CMC', formation_ids: [F, 'pas-un-id'], employe_ids: [E], date_echeance: '2026-11-01' }, ['CMC'])
    expect('valeurs' in r && r.valeurs.formation_ids).toEqual([F])
    expect('valeurs' in r && r.valeurs.date_echeance).toBe('2026-11-01')
  })
})
