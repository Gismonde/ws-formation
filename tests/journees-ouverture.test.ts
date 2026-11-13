import { describe, it, expect } from 'vitest'
import { aujourdhui, estProgrammee, journeeOuverte, etatJournee } from '@/lib/journees'

describe('journées de formation programmées', () => {
  // 13 nov. 2026, 21 h à Montréal = 14 nov. 02 h UTC
  const soir = new Date('2026-11-14T02:00:00Z')

  it('la date du jour suit l’heure de Montréal, pas l’UTC', () => {
    expect(aujourdhui(soir)).toBe('2026-11-13')
  })

  it('journée de demain : programmée ; d’aujourd’hui ou sans date : ouverte tout de suite', () => {
    expect(estProgrammee('2026-11-14', soir)).toBe(true)
    expect(estProgrammee('2026-11-13', soir)).toBe(false)
    expect(estProgrammee('2026-11-01', soir)).toBe(false)
    expect(estProgrammee(null, soir)).toBe(false)
  })

  it('l’employé ne voit pas une journée programmée', () => {
    expect(journeeOuverte({ modele: false, ouverte_le: null })).toBe(false)
    expect(journeeOuverte({ modele: false, ouverte_le: '2026-11-13T12:00:00Z' })).toBe(true)
    // Avant la migration (colonne absente) : comportement d’avant, visible
    expect(journeeOuverte({ modele: false })).toBe(true)
    expect(journeeOuverte({ modele: true, ouverte_le: '2026-11-13T12:00:00Z' })).toBe(false)
  })

  it('état côté administration', () => {
    expect(etatJournee({ date_journee: '2026-11-20', ouverte_le: null })).toEqual({ programmee: true, date: '2026-11-20' })
    expect(etatJournee({ date_journee: '2026-11-20', ouverte_le: '2026-11-20T12:00:05Z' })).toEqual({ programmee: false, date: '2026-11-20' })
    expect(etatJournee({ date_journee: null })).toEqual({ programmee: false, date: null })
  })
})
