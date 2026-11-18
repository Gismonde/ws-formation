import { describe, it, expect, vi } from 'vitest'
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))
import { lireCourrielInfo, composer } from '@/lib/courriels-information'

describe('courriel d’information', () => {
  it('objet, message et destinataires requis ; lien du bouton contrôlé', () => {
    expect(lireCourrielInfo({ objet: '', contenu: 'x', cible: { type: 'cliniques', cliniques: ['WSSC'] } })).toEqual({ erreur: 'L’objet est requis.' })
    expect(lireCourrielInfo({ objet: 'A', contenu: 'x', cible: { type: 'cliniques', cliniques: [] } })).toEqual({ erreur: 'Choisissez les destinataires.' })
    expect('erreur' in lireCourrielInfo({ objet: 'A', contenu: 'x', bouton_libelle: 'Voir', bouton_lien: 'javascript:1', cible: { type: 'cliniques', cliniques: ['WSSC'] } })).toBe(true)
    const r = lireCourrielInfo({ objet: 'A', contenu: 'x', bouton_libelle: 'Voir', bouton_lien: '/dashboard/comites', cible: { type: 'postes', postes: ['PAB'] } })
    expect('valeurs' in r && r.valeurs.cible).toEqual({ type: 'postes', postes: ['PAB'] })
  })

  it('salutation, puces, gras et images dans le courriel', () => {
    const { html, texte } = composer({ objet: 'Nouveautés', contenu: 'Intro **importante**\n![Bannière](/comites/banniere.webp)\n• Un\n• Deux', bouton_libelle: 'Voir', bouton_lien: '/dashboard/comites' }, { prenom: 'Marie', clinique: 'WSSC' }, 'https://exemple.com')
    expect(html).toContain('Bonjour <span')
    expect(html).toContain('<strong>importante</strong>')
    expect(html).toContain('<img src="https://exemple.com/comites/banniere.webp"')
    expect(html).toContain('<li')
    expect(html).toContain('https://exemple.com/dashboard/comites')
    expect(html).not.toContain('Vous pouvez consulter cette activité')
    expect(texte).not.toContain('![')
  })
})
