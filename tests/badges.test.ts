import { describe, it, expect } from 'vitest'
import { badgesPaliers } from '@/lib/badges'

describe('badges de palier', () => {
  it('aucun badge sans formation terminée', () => {
    expect(badgesPaliers(0).filter(b => b.obtenu)).toHaveLength(0)
  })
  it('6 formations : 1 et 5 obtenus, progression vers 10', () => {
    const b = badgesPaliers(6)
    expect(b.filter(x => x.obtenu).map(x => x.id)).toEqual(['palier:1', 'palier:5'])
    expect(b.find(x => x.id === 'palier:10')?.progression).toEqual({ fait: 6, total: 10 })
    expect(b.find(x => x.id === 'palier:1')?.progression).toEqual({ fait: 1, total: 1 })
  })
})

import { moisConsecutifs, badgeTheme, THEMES } from '@/lib/badges'
describe('badges supplémentaires', () => {
  it('suite de mois consécutifs', () => {
    expect(moisConsecutifs([])).toBe(0)
    expect(moisConsecutifs(['2026-01-10', '2026-02-03', '2026-02-20', '2026-03-31'])).toBe(3)
    expect(moisConsecutifs(['2025-12-15', '2026-01-15', '2026-03-15'])).toBe(2)
  })
  it('thème : au moins une formation terminée et rien en attente', () => {
    expect(badgeTheme([]).obtenu).toBe(false)
    expect(badgeTheme([{ complete: true }, { complete: false }]).obtenu).toBe(false)
    expect(badgeTheme([{ complete: true }], [{ confirmee: true }]).obtenu).toBe(true)
    expect(badgeTheme([{ complete: true }], [{ confirmee: false }]).progression).toEqual({ fait: 1, total: 2 })
  })
  it('reconnaît les thèmes', () => {
    expect(THEMES.infections.test('Prévention et contrôle des infections')).toBe(true)
    expect(THEMES.confidentialite.test('Loi 25 et protection des renseignements personnels')).toBe(true)
  })
})

import { appliquerReglages, seuilsDe, CONFIG_VIDE } from '@/lib/badges'
describe('réglages des badges', () => {
  const base = [...badgesPaliers(3), { id: 'sst', famille: 'conformite' as const, icone: '🦺', titre: 'SST formé', description: 'd', obtenu: true }]
  it('désactive et renomme', () => {
    const r = appliquerReglages(base, { reglages: { palier: { actif: false }, sst: { actif: true, titre: 'Santé-sécurité', icone: '⛑️' } }, perso: [] })
    expect(r.map(b => b.id)).toEqual(['sst'])
    expect(r[0]).toMatchObject({ titre: 'Santé-sécurité', icone: '⛑️' })
  })
  it('seuils réglés, triés, valeurs par défaut sinon', () => {
    expect(seuilsDe(CONFIG_VIDE, 'palier')).toEqual([1, 5, 10, 25])
    expect(seuilsDe({ reglages: { palier: { actif: true, seuils: [20, 3, 3] } }, perso: [] }, 'palier')).toEqual([3, 20])
    expect(badgesPaliers(4, [3, 20]).map(b => b.obtenu)).toEqual([true, false])
  })
})
