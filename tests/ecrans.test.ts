import { describe, it, expect } from 'vitest'
import { grouperEcrans } from '@/lib/ecrans'

const b = (type: string, ecran?: number) => ({ type, metadata: ecran === undefined ? {} : { ecran } })

describe('écrans de présentation', () => {
  it('regroupe un texte et son image, sinon un bloc par écran', () => {
    const g = grouperEcrans([b('text'), b('image'), b('quiz'), b('image'), b('text'), b('text')])
    expect(g.map(x => x.map(y => y.type))).toEqual([['text', 'image'], ['quiz'], ['image', 'text'], ['text']])
  })
  it('regroupe par numéro d’écran quand il est présent', () => {
    const g = grouperEcrans([b('text', 1), b('image', 1), b('interactif', 1), b('text', 2), b('quiz', 3), b('text', 3)])
    expect(g.map(x => x.length)).toEqual([3, 1, 2])
  })
  it('liste vide', () => { expect(grouperEcrans([])).toEqual([]) })
})
