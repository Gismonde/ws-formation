import { describe, it, expect } from 'vitest'
import { titreAttendu, meilleurElement, blocDepuisElement } from '@/lib/brancher-librairie'

const lib = [
  { id: '1', titre: 'Formation incendie', type: 'lien' as const, url: 'https://cmcmontreal.sharepoint.com/x', nom_fichier: null },
  { id: '2', titre: 'Formation incendie (2025)', type: 'video' as const, url: 'https://vimeo.com/1102279290', nom_fichier: null },
  { id: '3', titre: 'Communiqué CC-CMC : Directive MSSS – Charte de la langue français', type: 'lien' as const, url: 'https://cmcmontreal.sharepoint.com/y', nom_fichier: null },
  { id: '4', titre: 'Politique d’utilisation des uniformes', type: 'lien' as const, url: 'https://cmcmontreal.sharepoint.com/z', nom_fichier: null },
]

describe('brancher la librairie', () => {
  it('lit le titre entre guillemets des blocs « à ajouter »', () => {
    expect(titreAttendu('🎬 Vidéo à ajouter : « La mastectomie » (sur GrS)')).toBe('La mastectomie')
    expect(titreAttendu('Texte ordinaire « citation »')).toBeNull()
    expect(titreAttendu(null)).toBeNull()
  })
  it('préfère le titre identique, ignore accents et apostrophes', () => {
    expect(meilleurElement('Formation incendie', lib)?.id).toBe('1')
    expect(meilleurElement("Politique d'utilisation des uniformes", lib)?.id).toBe('4')
  })
  it('accepte un titre contenu dans un autre', () => {
    expect(meilleurElement('Directive MSSS – Charte de la langue français', lib)?.id).toBe('3')
    expect(meilleurElement('Inconnu total', lib)).toBeNull()
  })
  it('vidéo Vimeo intégrée, lien SharePoint en fichier', () => {
    expect(blocDepuisElement(lib[1]).type).toBe('video')
    expect(blocDepuisElement(lib[0])).toMatchObject({ type: 'file', url: lib[0].url, metadata: { librairie_id: '1' } })
  })
})
