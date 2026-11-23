import { describe, it, expect } from 'vitest'
import { traiteDemandeDe } from '@/lib/formations-libres'

describe('Demandes d’accès : administrateurs de la clinique de l’employé', () => {
  const cmc = { id: 'elisa', role: 'admin', clinique: 'CMC' }
  const wssc = { id: 'farah', role: 'admin', clinique: 'WSSC' }
  it('formation commune : un admin CMC ne traite pas la demande d’un employé WSSC', () => {
    expect(traiteDemandeDe(cmc, {}, 'WSSC')).toBe(false)
    expect(traiteDemandeDe(wssc, {}, 'WSSC')).toBe(true)
    expect(traiteDemandeDe(cmc, {}, 'CMC')).toBe(true)
  })
  it('l’administrateur global et le responsable désigné traitent toutes les demandes', () => {
    expect(traiteDemandeDe({ id: 'g', role: 'super_admin', clinique: null }, {}, 'WSSC')).toBe(true)
    expect(traiteDemandeDe(cmc, { responsable_id: 'elisa' }, 'WSSC')).toBe(true)
  })
  it('employé des deux cliniques : les admins des deux', () => {
    expect(traiteDemandeDe(cmc, {}, 'LES_DEUX')).toBe(true)
  })
})
