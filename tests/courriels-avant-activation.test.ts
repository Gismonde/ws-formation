import { describe, it, expect } from 'vitest'
import { adressesNonActivees } from '@/lib/comptes-actives'

// Faux client Supabase : employés, liens d'invitation utilisés, dernières connexions
function fauxClient(employes: { email: string; auth_user_id: string | null }[], liensUtilises: string[], connectes: string[]) {
  const chaine = (lignes: unknown[]) => {
    const q: any = { data: lignes, error: null }
    for (const m of ['select', 'not', 'in', 'range', 'eq']) q[m] = () => q
    return q
  }
  return {
    from: (t: string) => chaine(t === 'employes' ? employes : liensUtilises.map(a => ({ auth_user_id: a }))),
    auth: { admin: { getUserById: async (id: string) => ({ data: { user: { id, last_sign_in_at: connectes.includes(id) ? '2026-11-01T00:00:00Z' : null } } }) } },
  } as any
}

describe('aucun courriel avant l’activation du compte', () => {
  const sb = fauxClient([
    { email: 'Active@Exemple.com', auth_user_id: 'a1' },
    { email: 'lien@exemple.com', auth_user_id: 'a2' },
    { email: 'pas.active@exemple.com', auth_user_id: 'a3' },
  ], ['a2'], ['a1'])

  it('retient seulement les employés pas encore activés (casse ignorée), jamais les externes', async () => {
    const non = await adressesNonActivees(sb, ['active@exemple.com', 'LIEN@exemple.com', 'Pas.Active@exemple.com', 'externe@ailleurs.com'])
    expect(Array.from(non)).toEqual(['pas.active@exemple.com'])
  })
})
