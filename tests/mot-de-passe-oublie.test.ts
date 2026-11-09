// « Mot de passe oublié ? » : réponse uniforme, limite de demandes, invitations annulées, audit.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'

const inviter = vi.fn()
const audit = vi.fn()
vi.mock('@/lib/invitations', () => ({ inviterEmploye: (...a: unknown[]) => inviter(...a) }))
vi.mock('@/lib/audit', () => ({ logAudit: (...a: unknown[]) => audit(...a) }))

import { normaliserCourriel, motifExact, limiteAtteinte, demanderReinitialisation, MAX_DEMANDES } from '@/lib/mot-de-passe-oublie'

const lire = (p: string) => readFileSync(p, 'utf8')

/** Faux client Supabase : employés trouvés, nombre de demandes récentes, mises à jour notées. */
function fauxClient(emps: Record<string, unknown>[], recentes = 0) {
  const majs: { table: string; valeurs: unknown }[] = []
  const chaine = (table: string) => {
    const q: Record<string, unknown> = {}
    const soi = () => q
    for (const m of ['select', 'eq', 'is', 'gte', 'contains', 'ilike']) q[m] = soi
    q.limit = () => Promise.resolve({ data: emps })
    q.update = (v: unknown) => { majs.push({ table, valeurs: v }); return q }
    q.then = (ok: (v: unknown) => unknown) => Promise.resolve(table === 'audit_logs' ? { count: recentes } : { data: null }).then(ok)
    return q
  }
  return { client: { from: chaine } as never, majs }
}

const emp = { id: 'e1', prenom: 'Marie', nom: 'Tremblay', email: 'marie@exemple.com', clinique: 'WSSC', actif: true, auth_user_id: 'u1' }

describe('mot de passe oublié', () => {
  beforeEach(() => { inviter.mockReset(); audit.mockReset(); inviter.mockResolvedValue({ courrielEnvoye: true, lien: null, authUserId: 'u1' }) })

  it('normalise et valide le courriel', () => {
    expect(normaliserCourriel('  Marie@Exemple.COM ')).toBe('marie@exemple.com')
    expect(normaliserCourriel('pas-un-courriel')).toBeNull()
    expect(normaliserCourriel(undefined)).toBeNull()
  })
  it('échappe les jokers de la recherche', () => {
    expect(motifExact('a_b%c@x.com')).toBe('a\\_b\\%c@x.com')
  })
  it(`limite à ${MAX_DEMANDES} demandes`, () => {
    expect(limiteAtteinte(MAX_DEMANDES - 1)).toBe(false)
    expect(limiteAtteinte(MAX_DEMANDES)).toBe(true)
  })
  it('courriel inconnu : rien n’est envoyé', async () => {
    const { client } = fauxClient([])
    expect(await demanderReinitialisation(client, { email: 'x@y.com', origine: 'https://o' })).toBe('inconnu')
    expect(inviter).not.toHaveBeenCalled()
  })
  it('compte archivé : rien n’est envoyé', async () => {
    const { client } = fauxClient([{ ...emp, actif: false }])
    expect(await demanderReinitialisation(client, { email: emp.email, origine: 'https://o' })).toBe('inactif')
    expect(inviter).not.toHaveBeenCalled()
  })
  it('trop de demandes récentes : rien n’est envoyé', async () => {
    const { client } = fauxClient([emp], MAX_DEMANDES)
    expect(await demanderReinitialisation(client, { email: emp.email, origine: 'https://o' })).toBe('limite')
    expect(inviter).not.toHaveBeenCalled()
  })
  it('envoie le lien, annule les invitations ouvertes et journalise', async () => {
    const { client, majs } = fauxClient([emp])
    expect(await demanderReinitialisation(client, { email: 'MARIE@exemple.com', origine: 'https://o' })).toBe('envoye')
    expect(majs.some(m => m.table === 'invitations_employes')).toBe(true)
    expect(inviter).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ email: emp.email, nouveau: false, oubli: true }))
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ cible_employe_id: 'e1', metadata: expect.objectContaining({ motif: 'mdp_oublie' }) }))
  })
  it('la route répond toujours la même chose, avec une durée minimale', () => {
    const s = lire('src/app/api/auth/mot-de-passe-oublie/route.ts')
    expect(s.match(/NextResponse\.json\(/g)?.length).toBe(1)
    expect(s).toMatch(/DUREE_MIN_MS/)
  })
  it('la page de connexion propose le lien', () => {
    expect(lire('src/app/login/page.tsx')).toMatch(/href="\/mot-de-passe-oublie"/)
  })
})
