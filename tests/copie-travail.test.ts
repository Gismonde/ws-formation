import { describe, it, expect, vi } from 'vitest'
vi.mock('@/lib/permissions', () => ({ serviceClient: () => ({}), peutCreerFormations: () => true, peutGererContenu: () => true }))
vi.mock('@/lib/audit', () => ({ logAudit: async () => {} }))
import { reglagesARecopier } from '@/lib/copie-travail'

describe('copie de travail', () => {
  it('recopie le contenu des réglages, jamais l’identité, la publication ni la validation', () => {
    const r = reglagesARecopier({
      id: 'c', copie_de: 'o', clinique: 'CMC', creee_par: 'x', publiee: false, publiee_le: null, version: 1, version_le: null,
      statut_validation: 'approuvee', validee_par: 'v', created_at: 'd', updated_at: 'd',
      titre: 'Nouveau titre', description: 'Desc', credits_heures: 2, delivre_certificat: true,
    })
    expect(r).toEqual({ titre: 'Nouveau titre', description: 'Desc', credits_heures: 2, delivre_certificat: true })
  })
})
