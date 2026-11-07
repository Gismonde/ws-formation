// Séparation CMC / WSSC (Loi 25) : garde-fous contre les fuites entre cliniques.
// Origine : la liste des responsables des demandes d'accès proposait des employés des deux cliniques.
// Complète tests/acces-cliniques.test.ts (visibilité des contenus, dossiers et espaces).
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import type { Acteur } from '@/lib/permissions'
import { responsableAdmissible, adminConcerne, prerequisCompatible, cliniquesContenuDeLEspace } from '@/lib/cliniques'
import { peutTraiterDemandes } from '@/lib/formations-libres'
import { versionsCompatibles } from '@/lib/langues-formation'

function acteur(p: Partial<Acteur> & Pick<Acteur, 'role'>): Acteur {
  return {
    id: p.id ?? `id-${p.role}-${p.clinique ?? 'aucune'}`,
    auth_user_id: 'auth', prenom: null, nom: null, email: null,
    clinique: null, departement_id: null, peut_creer_formations: false,
    ...p,
  }
}
const superAdmin = acteur({ role: 'super_admin' })
const adminCMC = acteur({ role: 'admin', clinique: 'CMC' })
const adminWSSC = acteur({ role: 'admin', clinique: 'WSSC' })
const adminDeux = acteur({ role: 'admin', clinique: 'LES_DEUX' })
const gestCMC = acteur({ role: 'gestionnaire', clinique: 'CMC', departement_id: 'd' })
const gestWSSC = acteur({ role: 'gestionnaire', clinique: 'WSSC', departement_id: 'd' })
const employeCMC = acteur({ role: 'employe', clinique: 'CMC' })
const employeWSSC = acteur({ role: 'employe', clinique: 'WSSC' })

describe('Responsable des demandes d’accès', () => {
  it('pour une formation du CMC : seulement les admins et gestionnaires du CMC (et l’admin global)', () => {
    expect(responsableAdmissible(adminCMC, 'CMC')).toBe(true)
    expect(responsableAdmissible(gestCMC, 'CMC')).toBe(true)
    expect(responsableAdmissible(superAdmin, 'CMC')).toBe(true)
    expect(responsableAdmissible(adminDeux, 'CMC')).toBe(true)
    expect(responsableAdmissible(adminWSSC, 'CMC')).toBe(false)
    expect(responsableAdmissible(gestWSSC, 'CMC')).toBe(false)
  })
  it('jamais un simple employé, même de la bonne clinique', () => {
    expect(responsableAdmissible(employeCMC, 'CMC')).toBe(false)
    expect(responsableAdmissible(employeWSSC, 'WSSC')).toBe(false)
  })
  it('pour une formation commune : les admins et gestionnaires des deux cliniques', () => {
    expect(responsableAdmissible(adminWSSC, 'LES_DEUX')).toBe(true)
    expect(responsableAdmissible(gestCMC, null)).toBe(true)
  })
  it('une personne sans clinique n’est responsable de rien', () => {
    expect(responsableAdmissible(acteur({ role: 'admin' }), 'CMC')).toBe(false)
  })
})

describe('Traiter les demandes d’accès', () => {
  const formationCMC = { clinique: 'CMC', responsable_id: null }
  it('un admin du WSSC ne traite pas les demandes d’une formation du CMC', () => {
    expect(peutTraiterDemandes(adminWSSC, formationCMC)).toBe(false)
    expect(peutTraiterDemandes(adminCMC, formationCMC)).toBe(true)
    expect(peutTraiterDemandes(superAdmin, formationCMC)).toBe(true)
  })
  it('un responsable de l’autre clinique, nommé par erreur, ne peut rien traiter', () => {
    expect(peutTraiterDemandes(gestWSSC, { clinique: 'CMC', responsable_id: gestWSSC.id })).toBe(false)
    expect(peutTraiterDemandes(gestCMC, { clinique: 'CMC', responsable_id: gestCMC.id })).toBe(true)
  })
  it('un employé ne traite rien, même nommé responsable', () => {
    expect(peutTraiterDemandes(employeCMC, { clinique: 'CMC', responsable_id: employeCMC.id })).toBe(false)
    expect(peutTraiterDemandes(null, formationCMC)).toBe(false)
  })
})

describe('Avis et alertes aux administrateurs', () => {
  it('l’alerte de révision d’une politique du WSSC ne va pas aux admins du CMC', () => {
    expect(adminConcerne(adminWSSC, 'WSSC')).toBe(true)
    expect(adminConcerne(adminCMC, 'WSSC')).toBe(false)
    expect(adminConcerne(superAdmin, 'WSSC')).toBe(true)
    expect(adminConcerne(adminDeux, 'WSSC')).toBe(true)
  })
  it('jamais aux gestionnaires, aux employés ni aux comptes désactivés', () => {
    expect(adminConcerne(gestWSSC, 'WSSC')).toBe(false)
    expect(adminConcerne(employeWSSC, 'WSSC')).toBe(false)
    expect(adminConcerne({ role: 'admin', clinique: 'WSSC', actif: false }, 'WSSC')).toBe(false)
  })
  it('un contenu commun concerne les admins des deux cliniques', () => {
    expect(adminConcerne(adminCMC, 'LES_DEUX')).toBe(true)
    expect(adminConcerne(adminWSSC, null)).toBe(true)
  })
})

describe('Liens entre formations', () => {
  it('un prérequis ne vient jamais de l’autre clinique', () => {
    expect(prerequisCompatible('CMC', 'WSSC')).toBe(false)
    expect(prerequisCompatible('WSSC', 'CMC')).toBe(false)
    expect(prerequisCompatible('CMC', 'LES_DEUX')).toBe(true)
    expect(prerequisCompatible('LES_DEUX', 'CMC')).toBe(false)
  })
  it('une version anglaise est de la même clinique que la française', () => {
    expect(versionsCompatibles({ clinique: 'WSSC' }, { clinique: 'WSSC' })).toBe(true)
    expect(versionsCompatibles({ clinique: 'WSSC' }, { clinique: 'CMC' })).toBe(false)
    expect(versionsCompatibles({ clinique: 'WSSC' }, { clinique: 'LES_DEUX' })).toBe(false)
    expect(versionsCompatibles({ clinique: null }, { clinique: 'LES_DEUX' })).toBe(true)
  })
})

describe('Espace employé (certificats, historique, formations disponibles, suggestions)', () => {
  it('l’espace WSSC ne montre aucun contenu du CMC, et inversement', () => {
    expect(cliniquesContenuDeLEspace('WSSC')).not.toContain('CMC')
    expect(cliniquesContenuDeLEspace('CMC')).not.toContain('WSSC')
    expect(cliniquesContenuDeLEspace('WSSC')).toContain('LES_DEUX')
  })
})

// Garde-fou statique : toute route d'administration vérifie qui appelle avant de lire ou d'écrire.
function routes(dir: string): string[] {
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? routes(p) : n === 'route.ts' ? [p] : []
  })
}
describe('Routes d’administration', () => {
  const fichiers = routes(join(__dirname, '..', 'src', 'app', 'api', 'admin'))
  it('existent', () => expect(fichiers.length).toBeGreaterThan(20))
  it.each(fichiers.map(f => [f.split('/api/admin/')[1]]))('%s identifie l’appelant', (f) => {
    const src = readFileSync(join(__dirname, '..', 'src', 'app', 'api', 'admin', f), 'utf8')
    expect(/getActeur\(|getCreateurFormations\(/.test(src)).toBe(true)
  })
})

describe('Les écrans et routes utilisent bien la règle du responsable', () => {
  const lire = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8')
  it.each([
    ['src/app/admin/formations/[id]/modifier/page.tsx'],
    ['src/app/api/admin/formations/[id]/completer/route.ts'],
    ['src/app/api/formations/[id]/inscription-libre/route.ts'],
    ['src/lib/formations-libres.ts'],
  ])('%s', (p) => expect(lire(p)).toContain('responsableAdmissible('))
  it('les alertes de révision passent par adminConcerne', () => expect(lire('src/lib/rappels.ts')).toContain('adminConcerne('))
})
