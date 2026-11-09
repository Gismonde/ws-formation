// Mot de passe défini par un administrateur et lien d'invitation copié.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { regleMotDePasse, mdpTemporaire, CHEMINS_MDP_TEMPORAIRE } from '@/lib/mot-de-passe'

const lire = (p: string) => readFileSync(p, 'utf8')

describe('mot de passe défini par un administrateur', () => {
  it('applique la règle du portail', () => {
    expect(regleMotDePasse('Court1')).toMatch(/10 caractères/)
    expect(regleMotDePasse('toutminuscule1')).toMatch(/majuscule/)
    expect(regleMotDePasse('TOUTMAJUSCULE1')).toMatch(/minuscule/)
    expect(regleMotDePasse('SansChiffreIci')).toMatch(/chiffre/)
    expect(regleMotDePasse('Valide12345a')).toBeNull()
  })
  it('reconnaît le mot de passe temporaire', () => {
    expect(mdpTemporaire({ app_metadata: { mdp_temporaire: true } })).toBe(true)
    expect(mdpTemporaire({ app_metadata: {} })).toBe(false)
    expect(mdpTemporaire(null)).toBe(false)
    expect(CHEMINS_MDP_TEMPORAIRE).toContain('/dashboard/securite')
  })
  it('la route admin vérifie le périmètre, refuse sa propre fiche et ne journalise pas le mot de passe', () => {
    const s = lire('src/app/api/admin/definir-mot-de-passe/route.ts')
    expect(s).toMatch(/peutGererEmploye\(acteur, emp\)/)
    expect(s).toMatch(/emp\.id === acteur\.id/)
    expect(s).toMatch(/regleMotDePasse\(mdp\)/)
    expect(s).not.toMatch(/metadata: \{[^}]*motDePasse/)
  })
  it('le middleware impose le remplacement du mot de passe temporaire', () => {
    expect(lire('src/middleware.ts')).toMatch(/mdpTemporaire\(user\)/)
  })
  it('le remplacement exige le mot de passe actuel et un nouveau mot de passe différent', () => {
    const s = lire('src/app/api/profil/mot-de-passe/route.ts')
    expect(s).toMatch(/signInWithPassword/)
    expect(s).toMatch(/nouveau === actuel/)
    expect(s).toMatch(/mdp_temporaire: false/)
  })
  it('« Copier le lien » génère le lien sans envoyer de courriel', () => {
    expect(lire('src/app/api/admin/renvoyer-invitation/route.ts')).toMatch(/sansCourriel: copier === true/)
    expect(lire('src/lib/invitations.ts')).toMatch(/if \(sansCourriel\) return/)
  })
})
