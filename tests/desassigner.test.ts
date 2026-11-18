import { describe, it, expect, vi } from 'vitest'
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))
const journal: unknown[] = []
vi.mock('@/lib/audit', () => ({ logAudit: async (p: unknown) => { journal.push(p) } }))
import { desassignerFormation } from '@/lib/desassigner'
import { acteurDepuisEmploye } from '@/lib/permissions'

// Faux client : un employé, une formation, une assignation
function fauxClient(assignee = true) {
  const supprimees: unknown[] = []
  const chaine = (t: string) => {
    const q: any = {}
    q.select = () => q; q.eq = () => q; q.delete = () => { q.suppr = true; return q }
    q.maybeSingle = async () => ({ data: t === 'employes'
      ? { id: 'e1', prenom: 'Alex', nom: 'Roy', role: 'employe', clinique: 'WSSC', departement_id: 'd1' }
      : { id: 'f1', titre: 'Hygiène des mains', clinique: 'WSSC' } })
    q.then = (r: (v: unknown) => void) => { const data = assignee ? [{ id: 'a1' }] : []; if (q.suppr) supprimees.push(...data); r({ data, error: null }) }
    return q
  }
  return { sb: { from: chaine } as any, supprimees }
}
const admin = acteurDepuisEmploye({ id: 'adm', role: 'admin', clinique: 'WSSC', actif: true })!
const gestAutreDep = acteurDepuisEmploye({ id: 'g', role: 'gestionnaire', clinique: 'WSSC', departement_id: 'd2', peut_suivre_employes: true, actif: true })!

describe('désassigner une formation', () => {
  it('un administrateur retire l’assignation et l’inscrit au journal', async () => {
    const { sb, supprimees } = fauxClient()
    const r = await desassignerFormation(sb, admin, 'e1', 'f1')
    expect(r).toEqual({ ok: true, retirees: 1 })
    expect(supprimees).toHaveLength(1)
    expect(journal.at(-1)).toMatchObject({ type_action: 'FORMATION_DESASSIGNEE', cible_employe_id: 'e1', formation_id: 'f1' })
  })

  it('un gestionnaire d’un autre département est refusé, rien n’est retiré', async () => {
    const { sb, supprimees } = fauxClient()
    const r = await desassignerFormation(sb, gestAutreDep, 'e1', 'f1')
    expect(r).toMatchObject({ ok: false, statut: 403 })
    expect(supprimees).toHaveLength(0)
  })

  it('formation déjà retirée : message clair', async () => {
    const { sb } = fauxClient(false)
    expect(await desassignerFormation(sb, admin, 'e1', 'f1')).toMatchObject({ ok: false, statut: 404 })
  })
})
