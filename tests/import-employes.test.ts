import { describe, it, expect } from 'vitest'
import { lireCsv, reconnaitreColonnes, analyserImport, lireClinique, lireRole, type ContexteImport } from '@/lib/import-employes'

const ctx = (p: Partial<ContexteImport> = {}): ContexteImport => ({
  departements: [{ id: 'd1', nom: 'Bloc opératoire', clinique: 'WSSC' }, { id: 'd2', nom: 'Bloc opératoire', clinique: 'CMC' }, { id: 'd3', nom: 'Réception', clinique: 'CMC' }],
  cliniquesPossibles: ['CMC', 'WSSC', 'LES_DEUX'],
  rolesPossibles: ['super_admin', 'admin', 'gestionnaire', 'employe'],
  emailsExistants: new Set(['deja@ex.com']),
  ...p,
})

describe('lireCsv', () => {
  it('détecte le point-virgule, gère guillemets et BOM', () => {
    expect(lireCsv('﻿Prénom;Nom\n"Marie; A";"O""Neil"\r\n\n')).toEqual([['Prénom', 'Nom'], ['Marie; A', 'O"Neil']])
  })
  it('lit les virgules', () => {
    expect(lireCsv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']])
  })
})

describe('colonnes et valeurs', () => {
  it('reconnaît les en-têtes FR/EN', () => {
    expect(reconnaitreColonnes(['Prénom *', 'Last name', 'E-mail', 'Département'])).toEqual({ prenom: 0, nom: 1, email: 2, departement: 3 })
  })
  it('lit cliniques et rôles', () => {
    expect(lireClinique('Les deux')).toBe('LES_DEUX')
    expect(lireClinique('wssc')).toBe('WSSC')
    expect(lireClinique('')).toBeNull()
    expect(lireClinique('autre')).toBe('invalide')
    expect(lireRole('')).toBe('employe')
    expect(lireRole('Gestionnaire')).toBe('gestionnaire')
    expect(lireRole('patron')).toBe('invalide')
  })
})

describe('analyserImport', () => {
  const entete = ['Prénom', 'Nom', 'Courriel', 'Clinique', 'Département', 'Rôle']
  it('valide et signale les erreurs', () => {
    const { lignes } = analyserImport([
      entete,
      ['Marie', 'T', 'Marie@Ex.com', 'CMC', 'bloc operatoire', ''],
      ['Jean', 'D', 'marie@ex.com', 'CMC', '', ''],
      ['', 'X', 'deja@ex.com', 'WSSC', '', ''],
      ['Luc', 'Y', 'pasun', 'Mars', 'Inconnu', 'patron'],
      ['Ana', 'G', 'ana@ex.com', 'WSSC', '', 'Gestionnaire'],
    ], ctx())
    expect(lignes[0]).toMatchObject({ numero: 2, email: 'marie@ex.com', clinique: 'CMC', departement_id: 'd2', erreurs: [] })
    expect(lignes[1].erreurs).toEqual(['email_double_fichier'])
    expect(lignes[2].erreurs).toEqual(['prenom_manquant', 'email_existant'])
    expect(lignes[3].erreurs).toEqual(['email_invalide', 'role_invalide', 'clinique_invalide', 'departement_introuvable'])
    expect(lignes[4].erreurs).toEqual(['gestionnaire_sans_departement'])
  })
  it('signale les colonnes obligatoires manquantes', () => {
    expect(analyserImport([['Prénom', 'Nom'], ['a', 'b']], ctx()).colonnesManquantes).toEqual(['email'])
  })
  it('respecte le périmètre', () => {
    const { lignes } = analyserImport([entete, ['A', 'B', 'a@ex.com', 'WSSC', '', 'Gestionnaire']], ctx({ cliniquesPossibles: ['CMC', 'LES_DEUX'], rolesPossibles: ['employe'] }))
    expect(lignes[0].erreurs).toEqual(['role_non_autorise', 'clinique_hors_perimetre'])
  })
  it('impose le département du gestionnaire', () => {
    const { lignes } = analyserImport([['Prénom', 'Nom', 'Courriel'], ['A', 'B', 'a@ex.com']], ctx({ imposer: { clinique: 'CMC', departement_id: 'd3' } }))
    expect(lignes[0]).toMatchObject({ clinique: 'CMC', departement_id: 'd3', departement_nom: 'Réception', role: 'employe', erreurs: [] })
  })
})
