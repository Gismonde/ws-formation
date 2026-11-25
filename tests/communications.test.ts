import { describe, it, expect } from 'vitest'
import { lireCommunication, visiblePour, peutGererCommunication, grouperParTheme, lireNomTheme } from '@/lib/communications'

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

describe('Catégories et public des guides / consentements', () => {
  const base = { titre: 'G', clinique: 'WSSC', fichier: 'media:communications/2026/11/a.pdf', type_fichier: 'application/pdf' }
  const uuid = '11111111-2222-3333-4444-555555555555'
  it('garde la catégorie et le public pour un guide', () => {
    const r = lireCommunication({ ...base, categorie: 'guide', theme_id: uuid, public: 'patients' })
    expect('valeurs' in r && r.valeurs).toMatchObject({ categorie: 'guide', theme_id: uuid, public: 'patients' })
  })
  it('consentement : catégorie gardée, public toujours employés', () => {
    const r = lireCommunication({ ...base, categorie: 'consentement', theme_id: uuid, public: 'patients' })
    expect('valeurs' in r && r.valeurs).toMatchObject({ theme_id: uuid, public: 'employes' })
  })
  it('affiche : pas de catégorie ; identifiant invalide ignoré', () => {
    expect('valeurs' in lireCommunication({ ...base, theme_id: uuid }) && lireCommunication({ ...base, theme_id: uuid })).toMatchObject({ valeurs: { theme_id: null } })
    expect(lireCommunication({ ...base, categorie: 'guide', theme_id: "x' or 1=1" })).toMatchObject({ valeurs: { theme_id: null } })
  })
  it('regroupe par catégorie, ordre alphabétique, sans catégorie à la fin', () => {
    const themes = [{ id: 'n', nom: 'Nutrition' }, { id: 'c', nom: 'Chirurgie' }, { id: 'r', nom: 'Recherche' }]
    const g = grouperParTheme([{ theme_id: 'n' }, { theme_id: null }, { theme_id: 'c' }, { theme_id: 'disparu' }], themes)
    expect(g.map(x => x.theme?.nom ?? null)).toEqual(['Chirurgie', 'Nutrition', null])
    expect(g[2].elements).toHaveLength(2)
  })
  it('nom de catégorie obligatoire', () => {
    expect(lireNomTheme('  ')).toHaveProperty('erreur')
    expect(lireNomTheme('  Accès   aux dossiers ')).toEqual({ nom: 'Accès aux dossiers' })
  })
})
