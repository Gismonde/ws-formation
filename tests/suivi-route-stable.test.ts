// Suivi des leçons : envoi par une route stable (survit à une mise en ligne), file renvoyée en ligne.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
const lire = (p: string) => readFileSync(p, 'utf8')

describe('suivi des leçons après une mise en ligne', () => {
  it('le composant de leçon n’appelle plus d’action serveur', () => {
    const s = lire('src/components/lecon/SuiviLecon.tsx')
    expect(s).not.toMatch(/import \{[^}]*(terminerLecon|attesterLecture|enregistrerVideoVue)[^}]*\} from '@\/lib\/actions\/suivi'/)
    expect(s).toMatch(/envoyerSuivi\('terminer'/)
  })
  it('la route stable couvre les trois actions', () => {
    const s = lire('src/app/api/suivi/action/route.ts')
    for (const a of ['video', 'attestation', 'terminer']) expect(s).toContain(`'${a}'`)
    expect(s).toMatch(/getActeur\(\)/)
  })
  it('la file en attente est renvoyée en ligne, pas seulement au retour du réseau', () => {
    const s = lire('src/components/ModeHorsLigne.tsx')
    expect(s).toMatch(/usePathname/)
    expect(s).toMatch(/setInterval\(essai, 30_000\)/)
  })
  it('la page d’erreur recharge la nouvelle version', () => {
    expect(lire('src/app/error.tsx')).toMatch(/window\.location\.reload\(\)/)
  })
})
