import { describe, it, expect, vi } from 'vitest'
vi.mock('@/lib/permissions', () => ({ serviceClient: () => ({}) }))
import { notifEcheance } from '@/lib/notifications'
import { motsDe, correspondA, extrait } from '@/lib/recherche-employe'

describe('notifications d’échéance', () => {
  const f = { id: 'f1', titre: 'Hygiène des mains' }
  const maintenant = Date.parse('2026-10-20T12:00:00')
  it('en retard', () => expect(notifEcheance(f, '2026-10-18', maintenant)?.urgent).toBe(true))
  it('dans 3 jours ou moins', () => expect(notifEcheance(f, '2026-10-22', maintenant)?.vars?.n).toBe(2))
  it('rien si loin ou sans échéance', () => {
    expect(notifEcheance(f, '2026-11-30', maintenant)).toBeNull()
    expect(notifEcheance(f, null, maintenant)).toBeNull()
  })
})

describe('recherche employé', () => {
  it('ignore accents et casse, exige tous les mots', () => {
    const m = motsDe('Hygiene des MAINS')
    expect(correspondA('Formation : hygiène des mains au bloc', m)).toBe(true)
    expect(correspondA('Hygiène au bloc', m)).toBe(false)
  })
  it('extrait autour du mot trouvé, sans la mise en forme', () => {
    const x = extrait('Introduction. '.repeat(20) + '**Lavage** des mains : 20 secondes minimum.', motsDe('lavage'), 20)
    expect(x).toContain('Lavage des mains')
    expect(x.startsWith('…')).toBe(true)
  })
})
