import { describe, it, expect } from 'vitest'
import { validerElement, peutGererLibrairie, plateformeVideo } from '@/lib/librairie'
import type { Acteur } from '@/lib/permissions'

const acteur = (p: Partial<Acteur> & Pick<Acteur, 'role'>): Acteur => ({
  id: 'x', auth_user_id: 'a', prenom: null, nom: null, email: null, clinique: null, departement_id: null, peut_creer_formations: false, ...p,
})
const sa = acteur({ role: 'super_admin' })
const adminCMC = acteur({ role: 'admin', clinique: 'CMC' })
const gest = acteur({ role: 'gestionnaire', clinique: 'CMC', departement_id: 'd' })

describe('Librairie', () => {
  it('valide une vidéo YouTube et refuse une adresse non https', () => {
    expect('valeurs' in validerElement({ type: 'video', titre: 'CNESST', url: 'https://www.youtube.com/watch?v=7eWZD9gVtCw', clinique: 'CMC' }, sa)).toBe(true)
    expect(validerElement({ type: 'lien', titre: 'X', url: 'javascript:alert(1)', clinique: 'CMC' }, sa)).toEqual({ erreur: 'Adresse invalide : elle doit commencer par https://' })
    expect('erreur' in validerElement({ type: 'video', titre: 'X', url: 'https://exemple.ca/page', clinique: 'CMC' }, sa)).toBe(true)
  })

  it('un administrateur de clinique ne gère que sa clinique ; un gestionnaire sans autorisation, rien', () => {
    expect(peutGererLibrairie(adminCMC, 'CMC')).toBe(true)
    expect(peutGererLibrairie(adminCMC, 'WSSC')).toBe(false)
    expect(peutGererLibrairie(gest, 'CMC')).toBe(false)
    expect('erreur' in validerElement({ type: 'lien', titre: 'X', url: 'https://a.ca', clinique: 'WSSC' }, adminCMC)).toBe(true)
  })

  it('reconnaît la plateforme', () => {
    expect(plateformeVideo('https://vimeo.com/1036862869')).toBe('Vimeo')
    expect(plateformeVideo('https://cmcmontreal.sharepoint.com/:v:/g/abc')).toBe('SharePoint')
    expect(plateformeVideo('media:videos/a.mp4')).toBe('Fichier')
  })
})
