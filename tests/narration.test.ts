import { describe, it, expect } from 'vitest'
import { narrationDe, texteAudio, morceaux, texteParlable, audiosDe } from '@/lib/narration'

describe('narration audio', () => {
  it('lit la narration d’une image seule (texte non affiché)', () => {
    const blocs = [{ type: 'image', metadata: { narration: 'Voici le chariot de monitoring.' } }]
    expect(texteAudio(blocs)).toBe('Voici le chariot de monitoring.')
  })

  it('la narration remplace la lecture du texte affiché du même bloc', () => {
    const blocs = [
      { type: 'text', contenu: 'Texte court à l’écran', metadata: { narration: 'Explication détaillée à l’oral.' } },
      { type: 'text', contenu: '**Deuxième** bloc' },
    ]
    expect(texteAudio(blocs, 'Intro')).toBe('Intro Explication détaillée à l’oral. Deuxième bloc')
  })

  it('ignore une narration vide', () => {
    expect(narrationDe({ type: 'image', metadata: { narration: '   ' } })).toBeNull()
    expect(texteAudio([{ type: 'image', metadata: {} }])).toBe('')
  })

  it('nettoie le Markdown', () => {
    expect(texteParlable('## Titre\n\n- un\n- deux')).toBe('Titre. un deux')
  })

  it('découpe les longs textes aux fins de phrase', () => {
    const t = 'Phrase un. '.repeat(40)
    const m = morceaux(t, 50)
    expect(m.length).toBeGreaterThan(5)
    expect(m.every(x => x.length <= 50)).toBe(true)
    expect(m.join(' ').replace(/\s+/g, ' ')).toBe(t.trim())
  })
})

describe('fichiers audio', () => {
  it('un bloc avec fichier audio n’est pas lu par la voix de synthèse', () => {
    const blocs = [
      { type: 'text', contenu: 'Texte affiché', metadata: { audio: 'media:2026/11/a.mp3', narration: 'Script' } },
      { type: 'text', contenu: 'Autre texte' },
    ]
    expect(texteAudio(blocs)).toBe('Autre texte')
    expect(audiosDe(blocs)).toEqual(['media:2026/11/a.mp3'])
  })
})
