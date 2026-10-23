import { describe, it, expect } from 'vitest'
import { lireTemps, ecrireTemps, passageDe, questionsDe, dureeARegarder, questionAPoser } from '@/lib/video-passage'

describe('temps', () => {
  it('lit les formats courants', () => {
    expect(lireTemps('2:15')).toBe(135)
    expect(lireTemps('1:02:03')).toBe(3723)
    expect(lireTemps('135')).toBe(135)
    expect(lireTemps('2m15')).toBe(135)
    expect(lireTemps('2:75')).toBeNull()
    expect(lireTemps('abc')).toBeNull()
  })
  it('écrit', () => {
    expect(ecrireTemps(135)).toBe('2:15')
    expect(ecrireTemps(3723)).toBe('1:02:03')
    expect(ecrireTemps(null)).toBe('')
  })
})

describe('passage et questions', () => {
  it('passage valide seulement', () => {
    expect(passageDe({ passage: { debut: 135, fin: 340 } })).toEqual({ debut: 135, fin: 340 })
    expect(passageDe({ passage: { debut: 300, fin: 100 } })).toBeNull()
    expect(passageDe({})).toBeNull()
    expect(dureeARegarder({ debut: 100, fin: 160 }, 600)).toBe(60)
    expect(dureeARegarder({ debut: 100, fin: null }, 600)).toBe(500)
  })
  it('questions dans le passage, triées', () => {
    const meta = { passage: { debut: 100, fin: 300 }, questions_video: [
      { id: 'b', temps: 200, question: 'Q2', choix: ['a', 'b'], bonne: 0 },
      { id: 'a', temps: 150, question: 'Q1', choix: ['a', 'b'], bonne: 1 },
      { id: 'c', temps: 400, question: 'Hors passage', choix: ['a', 'b'], bonne: 0 },
      { id: 'd', temps: 120, question: 'Une seule réponse', choix: ['a'], bonne: 0 },
    ] }
    const q = questionsDe(meta)
    expect(q.map(x => x.id)).toEqual(['a', 'b'])
    expect(questionAPoser(q, [], 149)).toBeNull()
    expect(questionAPoser(q, [], 151)?.id).toBe('a')
    expect(questionAPoser(q, ['a'], 250)?.id).toBe('b')
  })
})
