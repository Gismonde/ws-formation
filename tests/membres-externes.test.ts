import { describe, it, expect } from 'vitest'
import { valeursExterne, externeOffert } from '@/lib/membres-externes'
import { analyserImport, lireCsv } from '@/lib/import-employes'

describe('membres externes', () => {
  it('offert seulement côté CMC', () => {
    expect(externeOffert('CMC')).toBe(true)
    expect(externeOffert('LES_DEUX')).toBe(true)
    expect(externeOffert('WSSC')).toBe(false)
  })
  it('employé du CMC seulement, organisation nettoyée', () => {
    expect(valeursExterne({ externe: true, organisation: '  GrS Montréal ' }, 'employe', 'CMC')).toEqual({ externe: true, organisation: 'GrS Montréal' })
    expect(valeursExterne({ externe: true, organisation: 'X' }, 'employe', 'WSSC')).toEqual({ externe: false, organisation: null })
    expect(valeursExterne({ externe: true }, 'gestionnaire', 'CMC')).toEqual({ externe: false, organisation: null })
    expect(valeursExterne({ externe: false, organisation: 'X' }, 'employe', 'CMC')).toEqual({ externe: false, organisation: null })
  })
  it('import : colonnes Externe et Organisation', () => {
    const lignes = lireCsv('Prénom;Nom;Courriel;Clinique;Externe;Organisation\nJulie;Roy;julie@ex.com;CMC;Oui;GrS Montréal\nMarc;Roy;marc@ex.com;WSSC;Oui;Autre')
    const r = analyserImport(lignes, { departements: [], cliniquesPossibles: ['CMC', 'WSSC'], rolesPossibles: ['employe'], emailsExistants: new Set() })
    expect(r.lignes[0]).toMatchObject({ externe: true, organisation: 'GrS Montréal' })
    expect(r.lignes[1]).toMatchObject({ externe: false, organisation: null })
  })
})
