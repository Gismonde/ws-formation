import { describe, it, expect } from 'vitest'
import { joursRestants, statutExpiration, palierRappelCertificat } from '@/lib/expirations'
import { nomOnglet, fichierCsv } from '@/lib/export-tableur'

const le = (iso: string) => new Date(iso + 'T15:30:00')

describe('Expiration des certificats', () => {
  it('compte les jours calendaires restants, sans tenir compte de l’heure', () => {
    expect(joursRestants('2026-11-19', le('2026-10-20'))).toBe(30)
    expect(joursRestants('2026-10-20', le('2026-10-20'))).toBe(0)
    expect(joursRestants('2026-10-19', le('2026-10-20'))).toBe(-1)
  })

  it('classe expiré / bientôt / valide selon l’horizon', () => {
    expect(statutExpiration(-1)).toBe('expire')
    expect(statutExpiration(0)).toBe('bientot')
    expect(statutExpiration(60)).toBe('bientot')
    expect(statutExpiration(61)).toBe('valide')
    expect(statutExpiration(45, 30)).toBe('valide')
  })

  it('déclenche les rappels à 60, 30, 7 jours et le jour même', () => {
    expect(palierRappelCertificat(61)).toBeNull()
    expect(palierRappelCertificat(60)).toBe('J-60')
    expect(palierRappelCertificat(31)).toBe('J-60')
    expect(palierRappelCertificat(30)).toBe('J-30')
    expect(palierRappelCertificat(7)).toBe('J-7')
    expect(palierRappelCertificat(1)).toBe('J-7')
    expect(palierRappelCertificat(0)).toBe('J-0')
  })

  it('rattrape le rappel du jour même si le service a manqué un jour, mais pas au-delà', () => {
    expect(palierRappelCertificat(-1)).toBe('J-0')
    expect(palierRappelCertificat(-2)).toBeNull()
  })
})

describe('Exports tableur', () => {
  it('produit des noms d’onglets Excel valides et uniques', () => {
    const pris = new Set<string>()
    expect(nomOnglet('Marie/Dupont: [test]?', pris)).toBe('Marie Dupont test')
    expect(nomOnglet('Marie Dupont test', pris)).toBe('Marie Dupont test (2)')
    expect(nomOnglet('x'.repeat(40), pris).length).toBe(31)
  })

  it('CSV : séparateur « ; », BOM, guillemets et protection contre les formules', () => {
    const csv = fichierCsv([{ titre: 'A', valeur: (l: string) => l }], ['simple', 'a;b', '=SOMME(A1)', 'dit "oui"'])
    expect(csv.startsWith('﻿A\r\n')).toBe(true)
    expect(csv).toContain('"a;b"')
    expect(csv).toContain("'=SOMME(A1)")
    expect(csv).toContain('"dit ""oui"""')
  })
})

import { palierRelanceEcheance } from '@/lib/echeances'
import { statutFormation, certificatValide } from '@/lib/etat-formations'

describe('Relances d’échéance', () => {
  it('relance 7 jours avant, la veille / le jour même, puis chaque semaine de retard', () => {
    expect(palierRelanceEcheance(8)).toBeNull()
    expect(palierRelanceEcheance(7)).toBe('J-7')
    expect(palierRelanceEcheance(2)).toBe('J-7')
    expect(palierRelanceEcheance(1)).toBe('J-1')
    expect(palierRelanceEcheance(0)).toBe('J-1')
    expect(palierRelanceEcheance(-1)).toBe('retard-1')
    expect(palierRelanceEcheance(-7)).toBe('retard-7')
    expect(palierRelanceEcheance(-34)).toBe('retard-28')
    expect(palierRelanceEcheance(-35)).toBeNull()
  })
})

describe('État d’une formation', () => {
  it('certifié l’emporte, terminé seulement sans questionnaire', () => {
    expect(statutFormation({ progressionPct: 40, aQuestionnaire: true, certificatValide: true, commence: true })).toBe('certifie')
    expect(statutFormation({ progressionPct: 100, aQuestionnaire: false, certificatValide: false, commence: true })).toBe('termine')
    expect(statutFormation({ progressionPct: 100, aQuestionnaire: true, certificatValide: false, commence: true })).toBe('en_cours')
    expect(statutFormation({ progressionPct: 0, aQuestionnaire: true, certificatValide: false, commence: false })).toBe('non_commence')
  })

  it('un certificat expiré ou invalidé ne compte plus', () => {
    const base = { numero_certificat: 'C', date_emission: null, note_finale: null }
    const ajd = new Date('2026-10-20T10:00:00')
    expect(certificatValide({ ...base, valide: true, date_expiration: null }, ajd)).toBe(true)
    expect(certificatValide({ ...base, valide: true, date_expiration: '2026-10-20' }, ajd)).toBe(true)
    expect(certificatValide({ ...base, valide: true, date_expiration: '2026-10-19' }, ajd)).toBe(false)
    expect(certificatValide({ ...base, valide: false, date_expiration: null }, ajd)).toBe(false)
  })
})

import { genererPdf, textePdf } from '@/lib/pdf-rapport'
import { classeurExcel } from '@/lib/export-tableur'

describe('Génération des fichiers', () => {
  it('PDF : document valide, accents conservés, émojis retirés', () => {
    expect(textePdf('✍️ Élise — « été » ’')).toBe('Élise — « été » ’')
    const pdf = genererPdf({
      titre: 'Rapport de conformité', perimetre: 'CMC',
      indicateurs: [['Employés', 3], ['Taux', '67 %']],
      sections: [{ titre: 'Détail', entetes: ['Employé', 'Statut'], lignes: [['Élise Gagné', 'Terminé']] }, { entetes: ['A'], lignes: [] }],
    })
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(pdf.length).toBeGreaterThan(2000)
  })

  it('Excel : classeur à plusieurs onglets', async () => {
    const x = await classeurExcel([
      { nom: 'Synthèse', colonnes: [{ titre: 'A', valeur: (l: number) => l }], lignes: [1, 2] },
      { nom: 'Détail', colonnes: [{ titre: 'B', valeur: (l: string) => l }], lignes: ['x'] },
    ])
    expect(x.subarray(0, 2).toString()).toBe('PK')
  })
})

import { validerReponse, agregerReponses } from '@/lib/sondages'

describe('Sondages de satisfaction', () => {
  const ok = { note_globale: 5, clarte: 4, utilite: 4, duree: 3, recommandation: 5, commentaire: '  Très bien  ' }
  it('valide les réponses de 1 à 5 et nettoie le commentaire', () => {
    const r = validerReponse(ok)
    expect('reponse' in r && r.reponse.commentaire).toBe('Très bien')
    expect('erreur' in validerReponse({ ...ok, clarte: 6 })).toBe(true)
    expect('erreur' in validerReponse({ ...ok, duree: undefined })).toBe(true)
    expect('erreur' in validerReponse({ ...ok, commentaire: 'x'.repeat(2001) })).toBe(true)
  })
  it('calcule moyennes, répartition et % de satisfaits', () => {
    const r = agregerReponses('f', [
      { ...ok, commentaire: null, created_at: '2026-10-01' },
      { ...ok, note_globale: 2, clarte: 2, commentaire: 'Trop long', created_at: '2026-10-02' },
    ])
    expect(r.reponses).toBe(2)
    expect(r.moyennes.clarte).toBe(3)
    expect(r.satisfaits).toBe(50)
    expect(r.repartition.note_globale).toEqual([0, 1, 0, 0, 1])
    expect(r.commentaires).toEqual([{ texte: 'Trop long', date: '2026-10-02' }])
  })
})

import { lireFiltresAudit, borneToronto, concerne } from '@/lib/audit-journal'

describe('Filtres du journal d’audit', () => {
  it('ne garde que des valeurs valides', () => {
    const f = lireFiltresAudit(new URLSearchParams({
      types: 'CONNEXION,INCONNU,CONNEXION_ECHOUEE', clinique: 'XYZ', departement: 'pas-un-uuid',
      employes: '0b7d0a3e-1c2d-4e5f-8a9b-0c1d2e3f4a5b,abc', date_debut: '2026-10-01', date_fin: '01/10/2026',
      recherche: 'abc),(acteur_id.eq.x%',
    }))
    expect(f.types).toEqual(['CONNEXION', 'CONNEXION_ECHOUEE'])
    expect(f.clinique).toBeNull()
    expect(f.departement_id).toBeNull()
    expect(f.employe_ids).toEqual(['0b7d0a3e-1c2d-4e5f-8a9b-0c1d2e3f4a5b'])
    expect(f.date_debut).toBe('2026-10-01')
    expect(f.date_fin).toBeNull()
    expect(f.recherche).not.toMatch(/[(),%]/)
  })
  it('borne les journées à l’heure de Montréal (été / hiver)', () => {
    expect(borneToronto('2026-07-01', false)).toBe('2026-07-01T00:00:00-04:00')
    expect(borneToronto('2026-01-15', true)).toBe('2026-01-15T23:59:59.999-05:00')
  })
  it('une entrée concerne l’auteur ou la personne visée', () => {
    expect(concerne({ acteur_id: 'a', cible_employe_id: null }, 'a')).toBe(true)
    expect(concerne({ acteur_id: 'b', cible_employe_id: 'a' }, 'a')).toBe(true)
    expect(concerne({ acteur_id: 'b', cible_employe_id: 'c' }, 'a')).toBe(false)
  })
})

import { lienValide, validerContenu, ACCUEIL_PAR_DEFAUT } from '@/lib/accueil'

describe('Page d’accueil', () => {
  it('n’accepte que des liens sûrs', () => {
    expect(lienValide('https://wssurgical.com/about-us')).toBe(true)
    expect(lienValide('/dashboard/sop')).toBe(true)
    expect(lienValide('#visite')).toBe(true)
    expect(lienValide('javascript:alert(1)')).toBe(false)
    expect(lienValide('http://exemple.com')).toBe(false)
    expect(lienValide('//exemple.com/x')).toBe(false)
  })
  it('les contenus par défaut sont valides', () => {
    for (const c of Object.values(ACCUEIL_PAR_DEFAUT)) expect('contenu' in validerContenu(c)).toBe(true)
  })
  it('refuse un lien dangereux et exige un titre', () => {
    const base = ACCUEIL_PAR_DEFAUT.CMC
    expect('erreur' in validerContenu({ ...base, cartes: [{ titre: 'X', texte: '', image: '', lien: 'javascript:x' }] })).toBe(true)
    expect('erreur' in validerContenu({ ...base, banniere: { ...base.banniere, titre: '' } })).toBe(true)
  })
})
