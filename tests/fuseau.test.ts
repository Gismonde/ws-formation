// Heures affichées dans le fuseau des cliniques, même si le serveur tourne en UTC.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { register } from '@/instrumentation'

describe('fuseau horaire', () => {
  it('le serveur passe à l’heure de Montréal au démarrage', () => {
    const avant = process.env.TZ
    process.env.TZ = 'UTC'
    register()
    expect(process.env.TZ).toBe('America/Toronto')
    // 20 novembre 2026, 14 h 00 UTC = 9 h 00 à Montréal
    expect(new Date('2026-11-20T14:00:00Z').getHours()).toBe(9)
    process.env.TZ = avant
  })
  it('les heures des événements précisent le fuseau', () => {
    for (const p of ['src/app/dashboard/evenements/[id]/page.tsx', 'src/app/dashboard/evenements/page.tsx', 'src/app/admin/evenements/[id]/GestionEvenement.tsx']) {
      expect(readFileSync(p, 'utf8')).toMatch(/toLocaleTimeString\(loc, \{[^}]*timeZone: FUSEAU/)
    }
  })
})
