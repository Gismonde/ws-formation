import { describe, it, expect } from 'vitest'
import { formatTemps, indexAuTemps } from '@/components/lecon/LecteurDemo'

describe('lecteur de démonstration', () => {
  it('formate la durée', () => {
    expect(formatTemps(0)).toBe('0:00')
    expect(formatTemps(42_400)).toBe('0:42')
    expect(formatTemps(65_000)).toBe('1:05')
  })
  it("trouve l'image affichée à un instant", () => {
    const debuts = [0, 1000, 3000, 3500]
    expect(indexAuTemps(debuts, 0)).toBe(0)
    expect(indexAuTemps(debuts, 999)).toBe(0)
    expect(indexAuTemps(debuts, 1000)).toBe(1)
    expect(indexAuTemps(debuts, 3200)).toBe(2)
    expect(indexAuTemps(debuts, 99999)).toBe(3)
  })
})
