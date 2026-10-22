import { describe, it, expect } from 'vitest'
import { titreDepuisFichier } from '@/lib/titre-fichier'
import { estVise, estPourToute } from '@/lib/politiques'

describe('titreDepuisFichier', () => {
  it('nettoie le nom du fichier', () => {
    expect(titreDepuisFichier('politique_de_confidentialite.pdf')).toBe('Politique de confidentialite')
    expect(titreDepuisFichier('politique-de-vacances-a-b.docx')).toBe('Politique de vacances a b')
    expect(titreDepuisFichier('Code éthique - 2026.PDF')).toBe('Code éthique - 2026')
    expect(titreDepuisFichier('  .pdf')).toBe('')
  })
})

describe('ciblage des politiques', () => {
  const base = { clinique: 'CMC' as const, departements: [] as string[] }
  const gest = { id: 'g', clinique: 'CMC', role: 'gestionnaire', departement_id: 'd1', poste: 'Chef de bloc' }
  const inf = { id: 'i', clinique: 'CMC', role: 'employe', departement_id: 'd2', poste: 'Infirmière' }
  const sa = { id: 's', clinique: null, role: 'super_admin', departement_id: null, poste: null }
  it('toute la clinique sans critère', () => {
    expect(estPourToute(base)).toBe(true)
    expect(estVise(base, inf)).toBe(true)
  })
  it('par rôle (l’admin global compte comme administrateur)', () => {
    const p = { ...base, roles: ['admin'] }
    expect(estVise(p, sa)).toBe(true)
    expect(estVise(p, gest)).toBe(false)
    expect(estVise({ ...base, roles: ['gestionnaire'] }, gest)).toBe(true)
  })
  it('par poste, sans tenir compte des accents ni des majuscules', () => {
    expect(estVise({ ...base, postes: ['infirmiere'] }, inf)).toBe(true)
    expect(estVise({ ...base, postes: ['infirmiere'] }, gest)).toBe(false)
  })
  it('un critère suffit ; la clinique reste obligatoire', () => {
    const p = { ...base, departements: ['d1'], employes: ['i'] }
    expect(estVise(p, gest)).toBe(true)
    expect(estVise(p, inf)).toBe(true)
    expect(estVise({ ...p, clinique: 'WSSC' as const }, inf)).toBe(false)
  })
})
