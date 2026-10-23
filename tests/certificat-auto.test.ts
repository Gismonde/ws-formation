import { describe, it, expect, vi } from 'vitest'
vi.mock('@/lib/questionnaire-serveur', () => ({ emettreCertificat: async () => null }))
vi.mock('@/lib/audit', () => ({ logAudit: async () => {} }))
import { toutesTerminees } from '@/lib/certificat-auto'

describe('certificat sans questionnaire', () => {
  it('seulement quand toutes les leçons sont terminées', () => {
    expect(toutesTerminees(['a', 'b'], ['a'])).toBe(false)
    expect(toutesTerminees(['a', 'b'], ['b', 'a', 'c'])).toBe(true)
    expect(toutesTerminees([], [])).toBe(false)
  })
})
