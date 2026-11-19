import { describe, it, expect } from 'vitest'
import { lireEdition } from '@/lib/passerelle'
import { imageValide } from '@/lib/comites'
import { lireCourrielInfo } from '@/lib/courriels-information'

const ed = (pdf: string, couverture = '') => lireEdition({ numero: 1, date_parution: '2026-11-01', pdf, couverture })

describe('Revue de sécurité', () => {
  it('une édition ne peut pas pointer vers les fichiers des propositions', () => {
    expect('erreur' in ed('media:passerelle-propositions/x/y.jpg')).toBe(true)
    expect('erreur' in ed('media:2026/11/../x.pdf')).toBe(true)
    const ok = ed('media:passerelle/2026/11/a.pdf', 'media:passerelle-propositions/x/y.jpg')
    expect('valeurs' in ok && ok.valeurs.couverture).toBe('')
  })
  it('images : https:// ou chemin du site, pas //autre-site ni guillemets', () => {
    expect(imageValide('/comites/sst.webp')).toBe('/comites/sst.webp')
    expect(imageValide('https://exemple.com/a.png')).toBe('https://exemple.com/a.png')
    expect(imageValide('//evil.com/a.png')).toBe('')
    expect(imageValide('https://a.com/x.png" onerror="x')).toBe('')
  })
  it('lien du bouton d’un courriel d’information', () => {
    const base = { objet: 'o', contenu: 'c', cible: { type: 'cliniques', cliniques: ['WSSC'] }, bouton_libelle: 'Voir' }
    expect('erreur' in lireCourrielInfo({ ...base, bouton_lien: '//evil.com' })).toBe(true)
    expect('erreur' in lireCourrielInfo({ ...base, bouton_lien: 'https://a.com/"x' })).toBe(true)
    expect('valeurs' in lireCourrielInfo({ ...base, bouton_lien: '/dashboard/passerelle' })).toBe(true)
  })
})
