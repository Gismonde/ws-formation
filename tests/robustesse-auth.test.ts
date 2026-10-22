import { describe, it, expect, vi } from 'vitest'
import { erreurTransitoire, getUserRobuste, AuthIndisponible } from '@/lib/supabase/robustesse'

describe('erreurTransitoire', () => {
  it('distingue panne passagère et session absente', () => {
    expect(erreurTransitoire({ name: 'AuthRetryableFetchError', status: 0 })).toBe(true)
    expect(erreurTransitoire({ name: 'AuthApiError', status: 503 })).toBe(true)
    expect(erreurTransitoire({ name: 'AuthApiError', status: 429 })).toBe(true)
    expect(erreurTransitoire({ name: 'AuthSessionMissingError', status: 400 })).toBe(false)
    expect(erreurTransitoire({ name: 'AuthApiError', status: 403, code: 'bad_jwt' })).toBe(false)
    expect(erreurTransitoire(null)).toBe(false)
  })
})

describe('getUserRobuste', () => {
  const ok = { data: { user: { id: 'u' } }, error: null }
  const panne = { data: { user: null }, error: { name: 'AuthRetryableFetchError', status: 0, message: 'fetch failed' } }
  it('réessaie puis réussit', async () => {
    const f = vi.fn().mockResolvedValueOnce(panne).mockResolvedValueOnce(ok)
    await expect(getUserRobuste(f)()).resolves.toBe(ok)
    expect(f).toHaveBeenCalledTimes(2)
  })
  it('lève AuthIndisponible si la panne persiste (pas de fausse déconnexion)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const f = vi.fn().mockResolvedValue(panne)
    await expect(getUserRobuste(f, 2)()).rejects.toBeInstanceOf(AuthIndisponible)
  })
  it('session absente : renvoyée telle quelle', async () => {
    const absente = { data: { user: null }, error: { name: 'AuthSessionMissingError', status: 400 } }
    const f = vi.fn().mockResolvedValue(absente)
    await expect(getUserRobuste(f)()).resolves.toBe(absente)
    expect(f).toHaveBeenCalledTimes(1)
  })
})
