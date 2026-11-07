import { describe, it, expect } from 'vitest'
import { lieuDePhoto, regrouperParLieu } from '@/lib/accueil'

const p = (legende: string, lieu?: string) => ({ url: '/x.webp', legende, ...(lieu ? { lieu } : {}) })

describe('visite virtuelle : lieu des photos', () => {
  it('reprend le lieu nommé dans la légende (FR et EN)', () => {
    expect(lieuDePhoto(p('Salle d’attente du C-190'))).toBe('C-190')
    expect(lieuDePhoto(p('PACU C-190'))).toBe('C-190')
    expect(lieuDePhoto(p('Espace détente - 250 (vue d’ensemble)'))).toBe('250')
    expect(lieuDePhoto(p('Salon cuisine coin employé 250'))).toBe('250')
    expect(lieuDePhoto(p('Lounge — 250'))).toBe('250')
    expect(lieuDePhoto(p('Clinique — 8ᵉ étage'))).toBe('8ᵉ étage')
    expect(lieuDePhoto(p('Salle 8 ème étage'))).toBe('8ᵉ étage')
    expect(lieuDePhoto(p('Reception — 8th floor'))).toBe('8ᵉ étage')
  })
  it('ne devine rien sans indication', () => {
    expect(lieuDePhoto(p('Salle d’opération 1'))).toBe('')
    expect(lieuDePhoto(p('Bureau de consultation 2'))).toBe('')
    expect(lieuDePhoto(p('Aimants de 2500 mm'))).toBe('')
  })
  it('le lieu choisi dans l’éditeur l’emporte', () => {
    expect(lieuDePhoto(p('Salle d’opération 1', 'C-190'))).toBe('C-190')
  })
  it('regroupe dans l’ordre, sans lieu à la fin', () => {
    const g = regrouperParLieu([p('Salle d’opération 1'), p('PACU C-190'), p('Accueil - 250'), p('Chambre C-190')])
    expect(g.map(x => [x.lieu, x.photos.length])).toEqual([['C-190', 2], ['250', 1], ['Autres', 1]])
  })
})
