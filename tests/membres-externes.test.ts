import { describe, it, expect } from 'vitest'
import { valeursExterne, externeOffert } from '@/lib/membres-externes'
import { analyserImport, lireCsv } from '@/lib/import-employes'

describe('membres externes', () => {
  it('offert dans les deux cliniques (pas sans clinique)', () => {
    expect(externeOffert('CMC')).toBe(true)
    expect(externeOffert('LES_DEUX')).toBe(true)
    expect(externeOffert('WSSC')).toBe(true)
    expect(externeOffert(null)).toBe(false)
  })
  it('employé seulement, organisation nettoyée', () => {
    expect(valeursExterne({ externe: true, organisation: '  GrS Montréal ' }, 'employe', 'CMC')).toEqual({ externe: true, organisation: 'GrS Montréal' })
    expect(valeursExterne({ externe: true, organisation: 'X' }, 'employe', 'WSSC')).toEqual({ externe: true, organisation: 'X' })
    expect(valeursExterne({ externe: true, organisation: 'X' }, 'employe', null)).toEqual({ externe: false, organisation: null })
    expect(valeursExterne({ externe: true }, 'gestionnaire', 'CMC')).toEqual({ externe: false, organisation: null })
    expect(valeursExterne({ externe: false, organisation: 'X' }, 'employe', 'CMC')).toEqual({ externe: false, organisation: null })
  })
  it('import : colonnes Externe et Organisation', () => {
    const lignes = lireCsv('Prénom;Nom;Courriel;Clinique;Externe;Organisation\nJulie;Roy;julie@ex.com;CMC;Oui;GrS Montréal\nMarc;Roy;marc@ex.com;WSSC;Oui;Autre')
    const r = analyserImport(lignes, { departements: [], cliniquesPossibles: ['CMC', 'WSSC'], rolesPossibles: ['employe'], emailsExistants: new Set() })
    expect(r.lignes[0]).toMatchObject({ externe: true, organisation: 'GrS Montréal' })
    expect(r.lignes[1]).toMatchObject({ externe: true, organisation: 'Autre' })
  })
})

import { nettoyerObjectifs } from '@/components/Objectifs'
describe('objectifs', () => {
  it('nettoie la liste', () => {
    expect(nettoyerObjectifs(['  A  b ', '', 'a B', 'C', 3])).toEqual(['A b', 'C'])
    expect(nettoyerObjectifs(null)).toEqual([])
    expect(nettoyerObjectifs(Array.from({ length: 20 }, (_, i) => 'o' + i))).toHaveLength(12)
  })
})
