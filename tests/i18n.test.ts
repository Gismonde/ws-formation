import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { EN } from '@/lib/i18n/en'
import { traducteur, pluriel } from '@/lib/i18n/base'

function fichiers(dir: string): string[] {
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? fichiers(p) : /\.(tsx?|ts)$/.test(n) ? [p] : []
  })
}

// Toutes les chaînes littérales passées à t(…) dans le code source
function clesUtilisees(): Map<string, string> {
  const cles = new Map<string, string>()
  const motif = /\bt\(\s*(['"])((?:\\.|(?!\1)[^\\])*)\1/g
  for (const f of fichiers(join(__dirname, '..', 'src'))) {
    const src = readFileSync(f, 'utf8')
    for (const m of Array.from(src.matchAll(motif))) {
      const cle = m[2].replace(/\\(['"\\])/g, '$1')
      if (!cles.has(cle)) cles.set(cle, f)
    }
  }
  return cles
}

describe('traduction anglaise', () => {
  it('chaque texte passé à t(…) a sa traduction', () => {
    const manquantes = Array.from(clesUtilisees()).filter(([c]) => !(c in EN)).map(([c, f]) => `${c}  (${f.split('/src/')[1]})`)
    expect(manquantes).toEqual([])
  })

  it('les variables {…} sont conservées dans la traduction', () => {
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',')
    const ecarts = Object.entries(EN).filter(([fr, en]) => vars(fr) !== vars(en)).map(([fr]) => fr)
    expect(ecarts).toEqual([])
  })

  it('remplace les variables et garde le français par défaut', () => {
    expect(traducteur('fr')('Bonjour {prenom} !', { prenom: 'Ana' })).toBe('Bonjour Ana !')
    expect(traducteur('en')('Texte inconnu')).toBe('Texte inconnu')
    expect(pluriel('fr', 1)).toBe(false)
    expect(pluriel('fr', 0)).toBe(false)
    expect(pluriel('en', 0)).toBe(true)
  })
})
