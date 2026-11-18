import { describe, it, expect } from 'vitest'
import { lireProposition, fichierAccepte, peutVoirPropositions, peutProposer, prefixeEmploye } from '@/lib/passerelle-propositions'

const E = '11111111-1111-1111-1111-111111111111'
const ref = (n: string, emp = E) => `media:${prefixeEmploye(emp)}${n}`

describe('Propositions de La Passerelle', () => {
  it('accepte PDF, JPEG et PNG jusqu’à 20 Mo', () => {
    expect(fichierAccepte('application/pdf', 1000)).toBeNull()
    expect(fichierAccepte('image/jpeg', 1000)).toBeNull()
    expect(fichierAccepte('image/png', 1000)).toBeNull()
    expect(fichierAccepte('image/gif', 1000)).toMatch(/Format/)
    expect(fichierAccepte('image/jpeg', 21 * 1024 * 1024)).toMatch(/volumineux/)
  })
  it('exige un titre et refuse les fichiers d’un autre employé', () => {
    expect(lireProposition({ sujet: '', message: 'x' }, E)).toEqual({ erreur: 'Donnez un titre à votre proposition.' })
    expect(lireProposition({ sujet: 'Fête', fichiers: [{ ref: ref('a.jpg', '22222222-2222-2222-2222-222222222222'), type: 'image/jpeg' }] }, E)).toEqual({ erreur: 'Fichier joint invalide.' })
    expect(lireProposition({ sujet: 'Fête', fichiers: [{ ref: ref('../x.jpg'), type: 'image/jpeg' }] }, E)).toEqual({ erreur: 'Fichier joint invalide.' })
    const ok = lireProposition({ sujet: ' Fête ', message: 'Photos', fichiers: [{ ref: ref('a.jpg'), nom: 'a.jpg', type: 'image/jpeg', taille: 10 }] }, E)
    expect(ok).toEqual({ valeurs: { sujet: 'Fête', message: 'Photos', fichiers: [{ ref: ref('a.jpg'), nom: 'a.jpg', type: 'image/jpeg', taille: 10 }] } })
  })
  it('les personnes choisies voient les propositions, quel que soit leur rôle', () => {
    expect(peutVoirPropositions({ id: E, role: 'employe', clinique: 'WSSC' }, [E])).toBe(true)
    expect(peutVoirPropositions({ id: 'autre', role: 'employe', clinique: 'WSSC' }, [E])).toBe(false)
    expect(peutVoirPropositions({ id: 'autre', role: 'super_admin', clinique: null }, [])).toBe(true)
  })
  it('seuls les employés du WSSC proposent', () => {
    expect(peutProposer({ role: 'employe', clinique: 'WSSC' })).toBe(true)
    expect(peutProposer({ role: 'employe', clinique: 'CMC' })).toBe(false)
  })
})
