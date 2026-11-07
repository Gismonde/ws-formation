// Concordance FR / EN : la comparaison de structure repère les écarts sans dépendre de la langue.
import { describe, it, expect } from 'vitest'
import { signatureBloc, comparerSignatures, type SignatureFormation } from '@/lib/concordance-langues'

const quiz = (bonnes: number[]) => JSON.stringify({ questions: bonnes.map(b => ({ question: 'q', reponses: ['a', 'b', 'c'], bonne_reponse: b })) })
const sig = (blocs: Parameters<typeof signatureBloc>[0][][], questionnaire: string[] = ['010'], modifiee_le: string | null = null): SignatureFormation =>
  ({ lecons: blocs.map(l => ({ blocs: l.map(signatureBloc) })), questionnaire, modifiee_le })

const fr = () => sig([
  [{ type: 'text', contenu: 'Bonjour' }, { type: 'image', url: '/a.webp' }],
  [{ type: 'interactif', metadata: { genre: 'accordeon', sections: [{ titre: 'A' }, { titre: 'B' }] } },
   { type: 'interactif', metadata: { genre: 'scenario', scenario: [{ choix: [{ bon: true }, { bon: false }] }] } },
   { type: 'interactif', metadata: { genre: 'glisser', paires: [{ element: 'x', categorie: 'Permis' }, { element: 'y', categorie: 'Interdit' }] } },
   { type: 'quiz', contenu: quiz([1, 0]) }],
])

describe('concordance FR / EN', () => {
  it('deux versions traduites mais de même structure concordent', () => {
    const en = sig([
      [{ type: 'text', contenu: 'Hello' }, { type: 'image', url: '/a.webp' }],
      [{ type: 'interactif', metadata: { genre: 'accordeon', sections: [{ titre: 'A en' }, { titre: 'B en' }] } },
       { type: 'interactif', metadata: { genre: 'scenario', scenario: [{ choix: [{ bon: true }, { bon: false }] }] } },
       { type: 'interactif', metadata: { genre: 'glisser', paires: [{ element: 'x', categorie: 'Permitted' }, { element: 'y', categorie: 'Prohibited' }] } },
       { type: 'quiz', contenu: quiz([1, 0]) }],
    ])
    expect(comparerSignatures(fr(), en).ecarts).toEqual([])
  })

  it('repère sections, images, bonnes réponses, catégories et questionnaire différents', () => {
    const en = sig([
      [{ type: 'text', contenu: 'Hello' }, { type: 'image', url: '/b.webp' }],
      [{ type: 'interactif', metadata: { genre: 'accordeon', sections: [{ titre: 'A' }] } },
       { type: 'interactif', metadata: { genre: 'scenario', scenario: [{ choix: [{ bon: false }, { bon: true }] }] } },
       { type: 'interactif', metadata: { genre: 'glisser', paires: [{ element: 'x', categorie: 'Permitted' }, { element: 'y', categorie: 'Permitted' }] } },
       { type: 'quiz', contenu: quiz([0, 0]) }],
    ], ['100'])
    const quoi = comparerSignatures(fr(), en).ecarts.map(e => e.quoi + ('bloc' in e ? `@${e.lecon}.${e.bloc}` : ''))
    expect(quoi).toEqual(['image@1.2', 'elements@2.1', 'reponses@2.2', 'reponses@2.3', 'reponses@2.4', 'question'])
  })

  it('repère un bloc manquant et un type différent', () => {
    const en = sig([[{ type: 'text' }], [{ type: 'text' }]])
    const e = comparerSignatures(fr(), en).ecarts
    expect(e[0]).toEqual({ quoi: 'blocs', lecon: 1, fr: 2, en: 1 })
    expect(e.some(x => x.quoi === 'type')).toBe(true)
  })

  it('signale la version française modifiée après l’anglaise', () => {
    const a = { ...fr(), modifiee_le: '2026-11-07T15:00:00Z' }, b = { ...fr(), modifiee_le: '2026-11-06T15:00:00Z' }
    expect(comparerSignatures(a, b).fr_modifiee_apres).toBe(true)
    expect(comparerSignatures(b, a).fr_modifiee_apres).toBe(false)
  })
})
