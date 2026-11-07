import { describe, it, expect } from 'vitest'
import { Versions, garderLaLangue, lireLangue } from '@/lib/langues-formation'
import { meilleurEtat, type EtatFormation } from '@/lib/etat-formations'

const FR = 'fr-1', EN = 'en-1', SEULE = 'seule'
const v = new Versions([
  { id: FR, langue: 'fr', version_de: null, publiee: true },
  { id: EN, langue: 'en', version_de: FR, publiee: true },
  { id: SEULE, langue: 'fr', version_de: null, publiee: true },
])

describe('versions linguistiques', () => {
  it('regroupe la version anglaise avec la française', () => {
    expect(v.racine(EN)).toBe(FR)
    expect(v.famille(FR).sort()).toEqual([EN, FR].sort())
    expect(v.famille(EN).sort()).toEqual([EN, FR].sort())
    expect(v.famille(SEULE)).toEqual([SEULE])
    expect(v.versionAnglaise(FR)?.id).toBe(EN)
  })

  it('donne la version de la langue de l’employé, depuis l’une ou l’autre', () => {
    expect(v.versionPour(FR, 'en')).toBe(EN)
    expect(v.versionPour(EN, 'fr')).toBe(FR)
    expect(v.versionPour(FR, 'fr')).toBe(FR)
    expect(v.versionPour(SEULE, 'en')).toBe(SEULE)
  })

  it('n’envoie jamais vers une version non publiée', () => {
    const b = new Versions([{ id: FR, langue: 'fr', publiee: true }, { id: EN, langue: 'en', version_de: FR, publiee: false }])
    expect(b.versionPour(FR, 'en')).toBe(FR)
  })

  it('reconnaît une version déjà assignée', () => {
    expect(v.dejaDansFamille(FR, new Set([EN]))).toBe(EN)
    expect(v.dejaDansFamille(SEULE, new Set([EN]))).toBeNull()
  })

  it('catalogue : retire la version de l’autre langue', () => {
    const liste = [{ id: FR }, { id: EN }, { id: SEULE }]
    expect(garderLaLangue(liste, v, 'en').map(f => f.id)).toEqual([EN, SEULE])
    expect(garderLaLangue(liste, v, 'fr').map(f => f.id)).toEqual([FR, SEULE])
    // Seule la version anglaise est ouverte : elle reste visible pour un francophone
    expect(garderLaLangue([{ id: EN }], v, 'fr').map(f => f.id)).toEqual([EN])
  })

  it('langue par défaut : français', () => {
    expect(lireLangue(undefined)).toBe('fr')
    expect(lireLangue('en')).toBe('en')
    expect(lireLangue('de')).toBe('fr')
  })
})

describe('l’une ou l’autre version compte', () => {
  const e = (statut: EtatFormation['statut'], progression: number): EtatFormation => ({ statut, progression, certificat: null, certificat_valide: false, suivi: null })
  it('garde le meilleur état', () => {
    expect(meilleurEtat(e('non_commence', 0), e('termine', 100)).statut).toBe('termine')
    expect(meilleurEtat(e('certifie', 100), e('termine', 100)).statut).toBe('certifie')
    expect(meilleurEtat(e('en_cours', 20), e('en_cours', 60)).progression).toBe(60)
  })
})
