import { describe, it, expect } from 'vitest'
import { CATALOGUE, GROUPES, remplir, rendreCourriel } from '@/lib/notifications-catalogue'
import { composerNotification, modeleEnVigueur } from '@/lib/notifications-courriel'

describe('catalogue des notifications', () => {
  it('clés uniques et groupes connus', () => {
    expect(new Set(CATALOGUE.map(t => t.cle)).size).toBe(CATALOGUE.length)
    expect(CATALOGUE.every(t => GROUPES.some(g => g.id === t.groupe))).toBe(true)
    expect(CATALOGUE.length).toBeGreaterThanOrEqual(55)
  })
  it('remplit les variables et retire les vides', () => {
    expect(remplir('Bonjour {prenom}\n{lieu}\nFin', { prenom: 'Marie' })).toBe('Bonjour Marie\n\nFin')
  })
  it('gabarit : salutation, activité en couleur, bouton, pied de page', () => {
    const { html, texte } = rendreCourriel({ origine: 'https://x', clinique: 'CMC', destinataire: 'Marie Tremblay', message: 'Inscription à {activite}.', vars: { activite: 'SST <base>' }, bouton: { libelle: 'Accéder à mon activité', lien: 'https://x/f' }, reglages: { contact_courriel: 'a@b.c' } })
    expect(html).toContain('Bonjour <span')
    expect(html).toContain('SST &lt;base&gt;')
    expect(html).toContain('grs-montreal.png')
    expect(html).toContain('Accéder à mon activité')
    expect(html).toContain('a@b.c')
    expect(texte).toContain('Bonjour Marie Tremblay,')
  })
  it('notification désactivée : aucun courriel ; texte personnalisé utilisé', () => {
    const cfg = { modeles: new Map([['rappel_completer', { cle: 'rappel_completer', actif: false, sujet: null, message: null, bouton: null }], ['inscription_cours_assignation', { cle: 'inscription_cours_assignation', actif: true, sujet: 'Hé {prenom}', message: 'Allez-y : {activite}', bouton: null }]]), reglages: { contact_libelle: '', contact_courriel: '', contact_telephone: '' } }
    expect(composerNotification(cfg, 'rappel_completer', { a: 'x@y.z', origine: 'o', clinique: 'CMC', prenom: 'A' })).toBeNull()
    const c = composerNotification(cfg, 'inscription_cours_assignation', { a: 'x@y.z', origine: 'o', clinique: 'WSSC', prenom: 'Léa', nom: 'Roy', vars: { activite: 'PCI' }, lien: 'o/f' })
    expect(c?.sujet).toBe('Hé Léa')
    expect(c?.texte).toContain('Allez-y : PCI')
    expect(modeleEnVigueur(null, 'inscription_cours_assignation')?.actif).toBe(true)
  })
})
