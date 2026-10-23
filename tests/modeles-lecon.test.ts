import { describe, it, expect } from 'vitest'
import { MODELES_LECON, blocsVersModele } from '@/lib/modeles-lecon'
import { styleEncadre, STYLES_ENCADRE } from '@/lib/texte-riche'
import { CLINIQUE_INFO } from '@/lib/cliniques'

describe('modèles de leçons', () => {
  it('identifiants uniques et blocs non vides', () => {
    expect(new Set(MODELES_LECON.map(m => m.id)).size).toBe(MODELES_LECON.length)
    for (const m of MODELES_LECON) expect(m.blocs.length).toBeGreaterThan(0)
  })
  it('enregistre une leçon sans identifiants', () => {
    const r = blocsVersModele([{ type: 'text', titre: 'T', contenu: 'C', metadata: { style: 'clinique' } }])
    expect(r).toEqual([{ type: 'text', titre: 'T', contenu: 'C', url: null, metadata: { style: 'clinique' } }])
  })
  it('encadré clinique aux couleurs de la clinique', () => {
    expect(styleEncadre('clinique', CLINIQUE_INFO.WSSC).bord).toBe(CLINIQUE_INFO.WSSC.couleur)
    expect(styleEncadre('clinique', null)).toEqual(STYLES_ENCADRE.clinique)
    expect(styleEncadre('attention', CLINIQUE_INFO.CMC)).toEqual(STYLES_ENCADRE.attention)
  })
})
