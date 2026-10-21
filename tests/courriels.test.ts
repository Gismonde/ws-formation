import { describe, it, expect, vi, afterEach } from 'vitest'
import { envoyerCourriels, courrielsActifs } from '@/lib/courriels'

const message = { a: 'ana@exemple.ca', sujet: 'Bonjour', html: '<p>Salut</p>', texte: 'Salut' }

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('Courriels', () => {
  it('inactifs sans configuration', async () => {
    vi.stubEnv('COURRIEL_EXPEDITEUR', ''); vi.stubEnv('MAILGUN_API_KEY', ''); vi.stubEnv('RESEND_API_KEY', '')
    expect(courrielsActifs()).toBe(false)
    expect(await envoyerCourriels([message])).toEqual({ envoyes: 0, erreur: 'non_configure' })
  })

  it('Mailgun : bon point d’accès, authentification et champs', async () => {
    vi.stubEnv('COURRIEL_EXPEDITEUR', 'WS Formation <formation@wssurgical.com>')
    vi.stubEnv('MAILGUN_API_KEY', 'cle-test'); vi.stubEnv('MAILGUN_DOMAIN', 'mg.wssurgical.com'); vi.stubEnv('MAILGUN_REGION', 'eu')
    vi.stubEnv('RESEND_API_KEY', 'ignoree')
    const appels: { url: string; init: RequestInit }[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => { appels.push({ url, init }); return new Response('{}', { status: 200 }) }))
    expect(await envoyerCourriels([message, { ...message, a: 'leo@exemple.ca' }])).toEqual({ envoyes: 2, erreur: undefined })
    expect(appels[0].url).toBe('https://api.eu.mailgun.net/v3/mg.wssurgical.com/messages')
    expect((appels[0].init.headers as Record<string, string>).Authorization).toBe('Basic ' + Buffer.from('api:cle-test').toString('base64'))
    const corps = new URLSearchParams(String(appels[0].init.body))
    expect(corps.get('to')).toBe('ana@exemple.ca')
    expect(corps.get('from')).toBe('WS Formation <formation@wssurgical.com>')
  })

  it('Mailgun : clé refusée, on s’arrête', async () => {
    vi.stubEnv('COURRIEL_EXPEDITEUR', 'x <x@y.ca>'); vi.stubEnv('MAILGUN_API_KEY', 'mauvaise'); vi.stubEnv('MAILGUN_DOMAIN', 'mg.y.ca')
    const f = vi.fn(async () => new Response('Forbidden', { status: 401 }))
    vi.stubGlobal('fetch', f)
    const r = await envoyerCourriels(Array.from({ length: 12 }, () => message))
    expect(r.envoyes).toBe(0)
    expect(r.erreur).toBe('Envoi refusé (401)')
    expect(f).toHaveBeenCalledTimes(5)
  })
})
