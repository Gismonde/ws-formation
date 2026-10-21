import { describe, it, expect } from 'vitest'
import { nouveauCiblage, lireCible, type EmployeCible } from '@/lib/assignations-groupees'

const emp = (id: string, clinique: string | null, departement_id: string | null, role = 'employe'): EmployeCible =>
  ({ id, prenom: id, nom: '', email: null, role, clinique, departement_id })
const ana = emp('a', 'CMC', 'bloc'), leo = emp('l', 'CMC', 'admin'), zoe = emp('z', 'WSSC', 'bloc')

describe('Politique : nouveau ciblage', () => {
  it('à des employés : les ajoute sans élargir, ignore ceux d’une autre clinique', () => {
    const n = nouveauCiblage({ clinique: 'CMC', departements: ['admin'], employes: [] }, { type: 'employes', ids: ['a', 'l', 'z'] }, [ana, leo, zoe])
    expect(n.employes).toEqual(['a'])
    expect(n.departements).toEqual(['admin'])
    expect(n.deja).toBe(1)          // Léo, déjà visé par son département
    expect(n.autre_clinique).toBe(1) // Zoé (WSSC)
    expect(n.elargie).toBe(false)
  })

  it('à un département : rien à faire si la politique vise déjà toute la clinique', () => {
    const n = nouveauCiblage({ clinique: 'CMC', departements: [], employes: [] }, { type: 'departements', ids: ['bloc'] }, [ana])
    expect(n.ajoutes).toHaveLength(0)
    expect(n.departements).toEqual([])
    expect(n.deja).toBe(1)
  })

  it('à un département : l’ajoute à une politique restreinte', () => {
    const n = nouveauCiblage({ clinique: 'CMC', departements: ['admin'] }, { type: 'departements', ids: ['bloc'] }, [ana])
    expect(n.departements).toEqual(['admin', 'bloc'])
    expect(n.ajoutes.map(e => e.id)).toEqual(['a'])
  })

  it('à toute une autre clinique : passe à « les deux » et à toute la clinique', () => {
    const n = nouveauCiblage({ clinique: 'CMC', departements: ['admin'] }, { type: 'clinique', clinique: 'WSSC' }, [zoe])
    expect(n.clinique).toBe('LES_DEUX')
    expect(n.departements).toEqual([])
    expect(n.elargie).toBe(true)
  })
})

describe('Lecture de la cible', () => {
  it('refuse les valeurs invalides', () => {
    expect(lireCible({ type: 'clinique', clinique: 'LES_DEUX' })).toBeNull()
    expect(lireCible({ type: 'employes', ids: ['pas-un-uuid'] })).toBeNull()
    expect(lireCible({ type: 'departements', ids: ['3f1c2b6e-1d2a-4c3b-9e8f-0a1b2c3d4e5f'] })).toEqual({ type: 'departements', ids: ['3f1c2b6e-1d2a-4c3b-9e8f-0a1b2c3d4e5f'] })
  })
})
