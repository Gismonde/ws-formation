import { describe, it, expect } from 'vitest'
import { lireCommunication, visiblePour, peutGererCommunication } from '@/lib/communications'

const base = { titre: 'Affiche', clinique: 'WSSC', fichier: 'media:communications/2026/11/a.pdf', type_fichier: 'application/pdf' }
describe('Affiches & communications', () => {
  it('valide titre, clinique, fichier et format', () => {
    expect('valeurs' in lireCommunication(base)).toBe(true)
    expect(lireCommunication({ ...base, titre: '' })).toEqual({ erreur: 'Donnez un titre.' })
    expect('erreur' in lireCommunication({ ...base, fichier: 'media:passerelle-propositions/x.jpg' })).toBe(true)
    expect('erreur' in lireCommunication({ ...base, fichier: 'media:communications/../x.pdf' })).toBe(true)
    expect('erreur' in lireCommunication({ ...base, type_fichier: 'text/html' })).toBe(true)
    expect('erreur' in lireCommunication({ ...base, clinique: 'AUTRE' })).toBe(true)
  })
  it('visible seulement si publiée et de la clinique de l’espace', () => {
    expect(visiblePour({ clinique: 'WSSC', publie: true }, ['WSSC', 'LES_DEUX'])).toBe(true)
    expect(visiblePour({ clinique: 'CMC', publie: true }, ['WSSC', 'LES_DEUX'])).toBe(false)
    expect(visiblePour({ clinique: 'LES_DEUX', publie: true }, ['CMC', 'LES_DEUX'])).toBe(true)
    expect(visiblePour({ clinique: 'WSSC', publie: false }, ['WSSC', 'LES_DEUX'])).toBe(false)
  })
  it('gérée par les administrateurs de la clinique', () => {
    expect(peutGererCommunication({ role: 'admin', clinique: 'CMC' }, 'WSSC')).toBe(false)
    expect(peutGererCommunication({ role: 'admin', clinique: 'WSSC' }, 'WSSC')).toBe(true)
    expect(peutGererCommunication({ role: 'super_admin', clinique: null }, 'CMC')).toBe(true)
    expect(peutGererCommunication({ role: 'gestionnaire', clinique: 'WSSC' }, 'WSSC')).toBe(false)
  })
})
