import { describe, it, expect } from 'vitest'
import { cliniqueAudit } from '@/lib/audit'
import { porteeClinique, lireFiltresAudit } from '@/lib/audit-journal'

// Faux client : employes et formations
const sb = (employes: Record<string, string | null>, formations: Record<string, string | null> = {}) => ({
  from: (t: string) => ({ select: () => ({ eq: (_: string, id: string) => ({ maybeSingle: async () => ({ data: t === 'employes' ? (id in employes ? { clinique: employes[id] } : null) : (id in formations ? { clinique: formations[id] } : null) }) }) }) }),
})

describe('Journal d’audit par clinique', () => {
  it('clinique explicite, puis employé visé, puis formation, puis auteur', async () => {
    expect(await cliniqueAudit(sb({}), { acteur_id: 'a', clinique: 'WSSC' })).toBe('WSSC')
    expect(await cliniqueAudit(sb({ c: 'CMC', a: 'WSSC' }), { acteur_id: 'a', cible_employe_id: 'c' })).toBe('CMC')
    expect(await cliniqueAudit(sb({ c: 'LES_DEUX', a: null }, { f: 'CMC' }), { acteur_id: 'a', cible_employe_id: 'c', formation_id: 'f' })).toBe('CMC')
    expect(await cliniqueAudit(sb({ a: 'WSSC' }), { acteur_id: 'a' })).toBe('WSSC')
    expect(await cliniqueAudit(sb({ a: null }), { acteur_id: 'a' })).toBeNull()
  })
  it('un administrateur d’une seule clinique ne voit que sa clinique', () => {
    const f = lireFiltresAudit(new URLSearchParams())
    expect(porteeClinique(f, { id: 'x', role: 'admin', clinique: 'CMC' } as never).clinique).toBe('CMC')
    expect(porteeClinique(f, { id: 'x', role: 'super_admin', clinique: null } as never).clinique).toBeNull()
  })
})
