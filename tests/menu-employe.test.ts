import { describe, it, expect } from 'vitest'
import { groupeActif, MENU_EMPLOYE } from '@/lib/menu-employe'

describe('menu employé', () => {
  it('6 entrées (Événements séparés des formations)', () => expect(MENU_EMPLOYE).toHaveLength(6))
  it('trouve le groupe et l’onglet, sous-pages comprises', () => {
    expect(groupeActif('/dashboard')?.groupe.id).toBe('formations')
    expect(groupeActif('/dashboard/badges')?.groupe.id).toBe('reussites')
    expect(groupeActif('/dashboard/politiques/abc')?.onglet.href).toBe('/dashboard/politiques')
    expect(groupeActif('/dashboard/journees/x')).toBeNull()
    expect(groupeActif('/dashboard/evenements/abc')?.groupe.id).toBe('evenements')
  })
})
