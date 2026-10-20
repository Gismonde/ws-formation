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
