import { describe, it, expect } from 'vitest'
import { prerequisCompatible } from '@/lib/cliniques'

describe('prerequisCompatible', () => {
  it('accepte un prérequis de la même clinique ou commun', () => {
    expect(prerequisCompatible('WSSC', 'WSSC')).toBe(true)
    expect(prerequisCompatible('WSSC', 'LES_DEUX')).toBe(true)
    expect(prerequisCompatible('CMC', 'LES_DEUX')).toBe(true)
  })
  it('refuse un prérequis de l’autre clinique', () => {
    expect(prerequisCompatible('WSSC', 'CMC')).toBe(false)
    expect(prerequisCompatible('CMC', 'WSSC')).toBe(false)
  })
  it('une formation commune n’accepte que des prérequis communs', () => {
    expect(prerequisCompatible('LES_DEUX', 'WSSC')).toBe(false)
    expect(prerequisCompatible('LES_DEUX', 'LES_DEUX')).toBe(true)
  })
})
