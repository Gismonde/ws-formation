import { describe, it, expect } from 'vitest'
import { lireCommunication, visiblePour, peutGererCommunication, grouperParTheme, lireNomTheme, themesEnArbre, cheminTheme, filtrerDocuments, type FiltreDocs } from '@/lib/communications'

const base = { titre: 'Affiche', clinique: 'WSSC', fichier: 'media:communications/2026/11/a.pdf', type_fichier: 'application/pdf' }
describe('Affiches & communications', () => {
  it('valide titre, clinique, fichier et format', () => {
    expect('valeurs' in lireCommunication(base)).toBe(true)
    expect(lireCommunication({ ...base, titre: '' })).toEqual({ erreur: 'Donnez un titre.' })
    expect('erreur' in lireCommunication({ ...base, fichier: 'media:passerelle-propositions/x.jpg' })).toBe(true)
    expect('erreur' in lireCommunication({ ...base, fichier: 'media:communications/../x.pdf' })).toBe(true)
    expect('erreur' in lireCommunication({ ...base, type_fichier: 'text/html' })).toBe(true)
    expect('erreur' in lireCommunication({ ...base, clinique: 'AUTRE' })).toBe(true)
  })
  it('visible seulement si publiée et de la clinique de l’espace', () => {
    expect(visiblePour({ clinique: 'WSSC', publie: true }, ['WSSC', 'LES_DEUX'])).toBe(true)
    expect(visiblePour({ clinique: 'CMC', publie: true }, ['WSSC', 'LES_DEUX'])).toBe(false)
    expect(visiblePour({ clinique: 'LES_DEUX', publie: true }, ['CMC', 'LES_DEUX'])).toBe(true)
    expect(visiblePour({ clinique: 'WSSC', publie: false }, ['WSSC', 'LES_DEUX'])).toBe(false)
  })
  it('gérée par les administrateurs de la clinique', () => {
    expect(peutGererCommunication({ role: 'admin', clinique: 'CMC' }, 'WSSC')).toBe(false)
    expect(peutGererCommunication({ role: 'admin', clinique: 'WSSC' }, 'WSSC')).toBe(true)
    expect(peutGererCommunication({ role: 'super_admin', clinique: null }, 'CMC')).toBe(true)
    expect(peutGererCommunication({ role: 'gestionnaire', clinique: 'WSSC' }, 'WSSC')).toBe(false)
  })
})

describe('Catégories et public des guides / consentements', () => {
  const base = { titre: 'G', clinique: 'WSSC', fichier: 'media:communications/2026/11/a.pdf', type_fichier: 'application/pdf' }
  const uuid = '11111111-2222-3333-4444-555555555555'
  it('garde la catégorie et le public pour un guide', () => {
    const r = lireCommunication({ ...base, categorie: 'guide', theme_id: uuid, public: 'patients' })
    expect('valeurs' in r && r.valeurs).toMatchObject({ categorie: 'guide', theme_id: uuid, public: 'patients' })
  })
  it('consentement : catégorie gardée, public toujours employés', () => {
    const r = lireCommunication({ ...base, categorie: 'consentement', theme_id: uuid, public: 'patients' })
    expect('valeurs' in r && r.valeurs).toMatchObject({ theme_id: uuid, public: 'employes' })
  })
  it('affiche : pas de catégorie ; identifiant invalide ignoré', () => {
    expect('valeurs' in lireCommunication({ ...base, theme_id: uuid }) && lireCommunication({ ...base, theme_id: uuid })).toMatchObject({ valeurs: { theme_id: null } })
    expect(lireCommunication({ ...base, categorie: 'guide', theme_id: "x' or 1=1" })).toMatchObject({ valeurs: { theme_id: null } })
  })
  it('regroupe par catégorie, ordre alphabétique, sans catégorie à la fin', () => {
    const themes = [{ id: 'n', nom: 'Nutrition', parent_id: null }, { id: 'c', nom: 'Chirurgie', parent_id: null }, { id: 'r', nom: 'Recherche', parent_id: null }]
    const g = grouperParTheme([{ theme_id: 'n' }, { theme_id: null }, { theme_id: 'c' }, { theme_id: 'disparu' }], themes)
    expect(g.map(x => x.theme?.nom ?? null)).toEqual(['Chirurgie', 'Nutrition', null])
    expect(g[2].elements).toHaveLength(2)
  })
  it('nom de catégorie obligatoire', () => {
    expect(lireNomTheme('  ')).toHaveProperty('erreur')
    expect(lireNomTheme('  Accès   aux dossiers ')).toEqual({ nom: 'Accès aux dossiers' })
  })
})

describe('Documents réservés à certains départements', () => {
  const doc = { clinique: 'WSSC', publie: true, departements: ['dep-admin', 'dep-rech'] }
  it('visible par ces départements, les admins et l’admin global seulement', () => {
    expect(visiblePour(doc, ['WSSC'], { role: 'employe', departement_id: 'dep-admin' })).toBe(true)
    expect(visiblePour(doc, ['WSSC'], { role: 'gestionnaire', departement_id: 'dep-rech' })).toBe(true)
    expect(visiblePour(doc, ['WSSC'], { role: 'admin', departement_id: null })).toBe(true)
    expect(visiblePour(doc, ['WSSC'], { role: 'super_admin', departement_id: null })).toBe(true)
    expect(visiblePour(doc, ['WSSC'], { role: 'employe', departement_id: 'dep-clinique' })).toBe(false)
    expect(visiblePour(doc, ['WSSC'], { role: 'gestionnaire', departement_id: null })).toBe(false)
    expect(visiblePour(doc, ['WSSC'], null)).toBe(false)
  })
  it('sans restriction : toute la clinique', () => {
    expect(visiblePour({ ...doc, departements: [] }, ['WSSC'], { role: 'employe', departement_id: 'x' })).toBe(true)
  })
  it('lit les départements (identifiants valides seulement)', () => {
    const u = '11111111-2222-3333-4444-555555555555'
    const r = lireCommunication({ titre: 'G', clinique: 'WSSC', fichier: 'media:communications/a.pdf', type_fichier: 'application/pdf', departements: [u, u, 'x'] })
    expect(r).toMatchObject({ valeurs: { departements: [u] } })
  })
})

describe('Sous-catégories (Chirurgie › type › chirurgien)', () => {
  const T = (id: string, nom: string, parent_id: string | null = null) => ({ id, nom, parent_id })
  const themes = [T('chir', 'Chirurgie'), T('gen', 'Chirurgie générale', 'chir'), T('bar', 'Chirurgie bariatrique', 'chir'),
    T('doyon', 'Dre Caroline Doyon', 'gen'), T('gagG', 'Dr Michel Gagner', 'gen'), T('gagB', 'Dr Michel Gagner', 'bar'), T('rech', 'Recherche')]
  it('arbre à plat, ordre alphabétique, niveaux', () => {
    expect(themesEnArbre(themes).map(t => `${t.niveau}:${t.nom}`)).toEqual([
      '0:Chirurgie', '1:Chirurgie bariatrique', '2:Dr Michel Gagner', '1:Chirurgie générale', '2:Dr Michel Gagner', '2:Dre Caroline Doyon', '0:Recherche'])
  })
  it('chemin complet', () => {
    expect(cheminTheme('doyon', themes).map(t => t.nom)).toEqual(['Chirurgie', 'Chirurgie générale', 'Dre Caroline Doyon'])
  })
  it('un document à plusieurs endroits ; totaux sans doublon', () => {
    const docs = [{ id: '1', themes: ['doyon'] }, { id: '2', themes: ['gagG', 'doyon'] }, { id: '3', themes: ['gagB'] }, { id: '4', themes: [] }, { id: '5', theme_id: 'rech' }]
    const g = grouperParTheme(docs, themes)
    expect(g.map(x => [x.theme?.nom ?? null, x.total])).toEqual([['Chirurgie', 3], ['Recherche', 1], [null, 1]])
    const gen = g[0].sous.find(s => s.theme?.id === 'gen')!
    expect(gen.total).toBe(2)
    expect(gen.sous.map(s => [s.theme?.nom, s.elements.map(e => e.id)])).toEqual([['Dr Michel Gagner', ['2']], ['Dre Caroline Doyon', ['1', '2']]])
  })
  it('lit plusieurs catégories', () => {
    const u = '11111111-2222-3333-4444-555555555555', v = '11111111-2222-3333-4444-666666666666'
    expect(lireCommunication({ titre: 'G', clinique: 'WSSC', categorie: 'guide', fichier: 'media:communications/a.pdf', type_fichier: 'application/pdf', themes: [u, v, u, 'x'] }))
      .toMatchObject({ valeurs: { themes: [u, v], theme_id: u } })
  })
})

describe('Explorateur : filtres', () => {
  const T = (id: string, nom: string, parent_id: string | null = null) => ({ id, nom, parent_id })
  const themes = [T('chir', 'Chirurgie'), T('ortho', 'Orthopédie', 'chir'), T('morcos', 'Dr Mina Morcos', 'ortho'), T('gen', 'Chirurgie générale', 'chir'), T('doyon', 'Dre Caroline Doyon', 'gen'), T('acc', 'Accès aux dossiers')]
  const docs = [
    { titre: 'Arthroscopie du genou – Dr Mina Morcos', description: 'Clinique Ortho Westmount · Novembre 2025 · Français', themes: ['morcos'] },
    { titre: 'Knee arthroscopy (EN) – Dr Mina Morcos', description: 'Clinique Ortho Westmount · November 2025 · English', themes: ['morcos'] },
    { titre: 'Cholécystectomie – Dre Caroline Doyon', description: 'Français', themes: ['doyon'] },
    { titre: 'Guide – Réception 250', description: 'Français', themes: [] },
  ]
  const f = (o: Partial<FiltreDocs>) => filtrerDocuments(docs, themes, { theme: null, q: '', langue: '', ...o }).map(d => d.titre)
  it('catégorie : inclut les sous-catégories', () => {
    expect(f({ theme: 'chir' })).toHaveLength(3)
    expect(f({ theme: 'ortho' })).toHaveLength(2)
    expect(f({ theme: 'sans' })).toEqual(['Guide – Réception 250'])
  })
  it('recherche sans accents, dans le titre et le chemin', () => {
    expect(f({ q: 'cholecystectomie' })).toEqual(['Cholécystectomie – Dre Caroline Doyon'])
    expect(f({ q: 'orthopedie genou' })).toEqual(['Arthroscopie du genou – Dr Mina Morcos'])
  })
  it('langue', () => {
    expect(f({ langue: 'en' })).toEqual(['Knee arthroscopy (EN) – Dr Mina Morcos'])
    expect(f({ langue: 'fr', theme: 'morcos' })).toEqual(['Arthroscopie du genou – Dr Mina Morcos'])
  })
})
