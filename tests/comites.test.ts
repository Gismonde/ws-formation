import { describe, it, expect } from 'vitest'
import { lireComite, initiales, peutGererComites } from '@/lib/comites'

describe('comités', () => {
  it('le nom est requis', () => {
    expect(lireComite({ nom: '  ' })).toEqual({ erreur: 'Le nom du comité est requis.' })
  })

  it('nettoie les champs, garde les membres utiles, brouillon par défaut', () => {
    const r = lireComite({ nom: ' Comité SST ', couleur: 'inconnue', membres: [
      { employe_id: '11111111-2222-3333-4444-555555555555', role: 'Présidente' },
      { nom: 'Invitée externe', role: 'Conseillère' },
      { nom: '', role: 'sans nom' },
    ] })
    expect('valeurs' in r && r.valeurs).toMatchObject({ nom: 'Comité SST', couleur: 'violet', icone: '🤝', publie: false })
    expect('valeurs' in r && r.valeurs.membres).toHaveLength(2)
  })

  it('initiales des membres', () => {
    expect(initiales('Marie Tremblay')).toBe('MT')
    expect(initiales('Anne-Marie Lacroix')).toBe('AL')
    expect(initiales('Farah')).toBe('F')
  })

  it('seuls les administrateurs qui voient le WSSC gèrent les comités', () => {
    expect(peutGererComites({ role: 'super_admin', clinique: 'CMC' })).toBe(true)
    expect(peutGererComites({ role: 'admin', clinique: 'WSSC' })).toBe(true)
    expect(peutGererComites({ role: 'admin', clinique: 'CMC' })).toBe(false)
    expect(peutGererComites({ role: 'gestionnaire', clinique: 'WSSC' })).toBe(false)
  })
})

import { lireBanniere } from '@/lib/comites'
describe('bannière des comités', () => {
  it('titre par défaut, image limitée aux adresses https:// ou /…', () => {
    expect(lireBanniere({ titre: ' ', texte: ' Bonjour ', image: 'javascript:alert(1)' })).toEqual({ titre: 'Apprenez à connaître vos comités', texte: 'Bonjour', image: '' })
    expect(lireBanniere({ image: '/comites/banniere.webp' }).image).toBe('/comites/banniere.webp')
    expect(lireBanniere({ image: 'https://exemple.com/a.png' }).image).toBe('https://exemple.com/a.png')
  })
})

import { blocsTexte } from '@/lib/comites'
describe('mise en forme des textes de comité', () => {
  it('paragraphes et listes à puces', () => {
    expect(blocsTexte('Intro.\n\n• Un;\n• Deux;\nFin.')).toEqual([
      { type: 'paragraphe', texte: 'Intro.' },
      { type: 'liste', items: ['Un;', 'Deux;'] },
      { type: 'paragraphe', texte: 'Fin.' },
    ])
  })
})
