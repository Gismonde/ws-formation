import { describe, it, expect } from 'vitest'
import { infosCouverture, lireEdition, lireSommaire, peutGererPasserelle } from '@/lib/passerelle'

describe('La Passerelle', () => {
  it('repère date, volume, numéro et temps de lecture sur la couverture', () => {
    expect(infosCouverture('LA PASSERELLE Le 7 juillet 2026 Volume 1. Édition 3 … devrait vous prendre environ 15 minutes.'))
      .toEqual({ date_parution: '2026-07-07', volume: 1, numero: 3, temps_lecture: 15 })
    expect(infosCouverture('Le 1er mai 2026').date_parution).toBe('2026-05-01')
  })

  it('sommaire : « Titre | page », page facultative', () => {
    expect(lireSommaire('Mot de votre directeur | 3\nInvitation au 5 à 7|13\n\nRubrique sans page')).toEqual([
      { titre: 'Mot de votre directeur', page: 3 }, { titre: 'Invitation au 5 à 7', page: 13 }, { titre: 'Rubrique sans page', page: null },
    ])
  })

  it('une édition exige numéro, date et PDF privé', () => {
    expect(lireEdition({ numero: 4, date_parution: '2026-09-08', pdf: 'https://exemple.com/a.pdf' })).toEqual({ erreur: 'Déposez le PDF de l’édition.' })
    const r = lireEdition({ numero: '4', date_parution: '2026-09-08', pdf: 'media:2026/11/x.pdf', couleur: 'orange' })
    expect('valeurs' in r && r.valeurs).toMatchObject({ numero: 4, volume: 1, couleur: 'orange', publie: false })
  })

  it('gérée par les administrateurs qui voient le WSSC', () => {
    expect(peutGererPasserelle({ role: 'admin', clinique: 'WSSC' })).toBe(true)
    expect(peutGererPasserelle({ role: 'admin', clinique: 'CMC' })).toBe(false)
    expect(peutGererPasserelle({ role: 'employe', clinique: 'WSSC' })).toBe(false)
  })
})
