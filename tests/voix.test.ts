import { describe, it, expect } from 'vitest'
import { voixProfessionnelle, voixPour } from '@/lib/voix'

const v = (name: string, lang: string, localService = true) => ({ name, lang, localService })

describe('voix de lecture', () => {
  it('retire les voix fantaisie et Eloquence', () => {
    for (const n of ['Bad News', 'Bubbles', 'Zarvox', 'Whisper', 'Grandma (French (Canada))', 'Eddy (Français (France))', 'Jester']) expect(voixProfessionnelle(n)).toBe(false)
    for (const n of ['Amélie', 'Thomas', 'Google français', 'Microsoft Sylvie Online (Natural) - French (Canada)', 'Samantha']) expect(voixProfessionnelle(n)).toBe(true)
  })
  it('garde la langue et met les voix naturelles en premier', () => {
    const liste = voixPour([v('Bubbles', 'en-US'), v('Thomas', 'fr-FR'), v('Microsoft Sylvie Online (Natural) - French (Canada)', 'fr-CA', false), v('Samantha', 'en-US'), v('Amélie', 'fr-CA')], 'fr')
    expect(liste.map(x => x.name)).toEqual(['Microsoft Sylvie Online (Natural) - French (Canada)', 'Amélie', 'Thomas'])
    expect(voixPour([v('Samantha', 'en-US'), v('Bubbles', 'en-US')], 'en').map(x => x.name)).toEqual(['Samantha'])
  })
})
