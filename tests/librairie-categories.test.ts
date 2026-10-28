import { describe, it, expect } from 'vitest'
import { arbreCategories, nomsDuFiltre, deplacer, nomValide } from '@/lib/librairie-categories'
import { maxRegarde, positionPermise } from '@/lib/video-avance'

const L = [
  { id: 'a', nom: 'Formations organisationnelles', parent_id: null, ordre: 1 },
  { id: 'b', nom: 'Politiques et procédures', parent_id: 'a', ordre: 1 },
  { id: 'c', nom: 'Formation continue', parent_id: null, ordre: 2 },
  { id: 'd', nom: 'Clinique préopératoire', parent_id: 'c', ordre: 2 },
  { id: 'e', nom: 'Clinique postopératoire', parent_id: 'c', ordre: 1 },
]

describe('catégories de la librairie', () => {
  it('arbre dans l’ordre, sous-catégories après leur parent', () => {
    expect(arbreCategories(L).map(c => `${c.niveau}:${c.id}`)).toEqual(['0:a', '1:b', '0:c', '1:e', '1:d'])
  })
  it('filtre par catégorie principale = elle + ses sous-catégories', () => {
    expect(nomsDuFiltre(L, 'Formation continue').sort()).toEqual(['Clinique postopératoire', 'Clinique préopératoire', 'Formation continue'].sort())
    expect(nomsDuFiltre(L, 'Inconnue')).toEqual(['Inconnue'])
  })
  it('déplacement parmi les frères', () => {
    expect(deplacer(L, 'd', -1)).toEqual([{ id: 'd', ordre: 1 }, { id: 'e', ordre: 2 }])
    expect(deplacer(L, 'a', -1)).toEqual([])
  })
  it('nom nettoyé', () => {
    expect(nomValide('  SST   formé ')).toBe('SST formé')
    expect(nomValide('')).toBeNull()
  })
})

describe('empêcher d’avancer dans la vidéo', () => {
  it('le maximum suit la lecture normale, pas les sauts', () => {
    expect(maxRegarde(10, 11)).toBe(11)
    expect(maxRegarde(10, 60)).toBe(10)
    expect(maxRegarde(10, 5)).toBe(10)
  })
  it('un saut au-delà du maximum ramène au maximum ; revenir en arrière est permis', () => {
    expect(positionPermise(10, 60)).toBe(10)
    expect(positionPermise(10, 11)).toBeNull()
    expect(positionPermise(10, 3)).toBeNull()
  })
})
