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
