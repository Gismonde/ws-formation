// Règles d'accès par clinique (Loi 25).
// Ces tests protègent le cloisonnement CMC / WSSC : un employé ne doit jamais voir, recevoir
// ou gérer le contenu ou les données de l'autre clinique.
// Les mêmes règles existent en SQL (RLS, supabase/migrations/formations_sop_par_clinique.sql).
import { describe, it, expect } from 'vitest'
import {
  type Acteur,
  cliniquesContenuVisibles, cliniquesContenuGerables, peutVoirContenu, peutGererContenu,
  employeConcerneParClinique, peutVoirEmploye, peutGererEmploye, filtrerEmployes,
  cliniquesAttribuables, rolesAttribuables, peutCreerFormations,
} from '@/lib/permissions'
import { espaceActif, espacesPossibles, cliniquesContenuDeLEspace } from '@/lib/cliniques'
import { estVise } from '@/lib/politiques'

// ---------------------------------------------------------------------------
// Acteurs types

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
const gestCMC = acteur({ role: 'gestionnaire', clinique: 'CMC', departement_id: 'dept-bloc' })
const gestCMCCreateur = acteur({ role: 'gestionnaire', clinique: 'CMC', departement_id: 'dept-bloc', peut_creer_formations: true })
const employeCMC = acteur({ role: 'employe', clinique: 'CMC', departement_id: 'dept-bloc' })
const employeWSSC = acteur({ role: 'employe', clinique: 'WSSC', departement_id: 'dept-bloc' })
const employeDeux = acteur({ role: 'employe', clinique: 'LES_DEUX' })
const employeSansClinique = acteur({ role: 'employe' })

// ---------------------------------------------------------------------------

describe('Voir un contenu (formation, SOP)', () => {
  it("un employé du CMC ne voit jamais un contenu du WSSC", () => {
    expect(peutVoirContenu(employeCMC, 'WSSC')).toBe(false)
    expect(cliniquesContenuVisibles(employeCMC)).not.toContain('WSSC')
  })

  it("un employé du WSSC ne voit jamais un contenu du CMC", () => {
    expect(peutVoirContenu(employeWSSC, 'CMC')).toBe(false)
  })

  it('un employé voit les contenus de sa clinique et les contenus communs', () => {
    expect(peutVoirContenu(employeCMC, 'CMC')).toBe(true)
    expect(peutVoirContenu(employeCMC, 'LES_DEUX')).toBe(true)
  })

  it('un employé rattaché aux deux cliniques voit tout', () => {
    expect(cliniquesContenuVisibles(employeDeux).sort()).toEqual(['CMC', 'LES_DEUX', 'WSSC'])
  })

  it('un employé sans clinique ne voit que les contenus communs', () => {
    expect(cliniquesContenuVisibles(employeSansClinique)).toEqual(['LES_DEUX'])
  })

  it("un admin de clinique ne voit pas le contenu de l'autre clinique", () => {
    expect(peutVoirContenu(adminCMC, 'WSSC')).toBe(false)
    expect(peutVoirContenu(adminWSSC, 'CMC')).toBe(false)
  })

  it("l'admin global voit tout", () => {
    expect(cliniquesContenuVisibles(superAdmin).sort()).toEqual(['CMC', 'LES_DEUX', 'WSSC'])
  })

  it('un contenu sans clinique est traité comme commun', () => {
    expect(peutVoirContenu(employeCMC, null)).toBe(true)
  })
})

describe('Créer / modifier un contenu', () => {
  it("un admin du CMC ne gère que les contenus du CMC (ni WSSC, ni communs)", () => {
    expect(cliniquesContenuGerables(adminCMC)).toEqual(['CMC'])
    expect(peutGererContenu(adminCMC, 'WSSC')).toBe(false)
    expect(peutGererContenu(adminCMC, 'LES_DEUX')).toBe(false)
  })

  it('un admin rattaché aux deux cliniques gère tout', () => {
    expect(cliniquesContenuGerables(adminDeux).sort()).toEqual(['CMC', 'LES_DEUX', 'WSSC'])
  })

  it('un gestionnaire sans autorisation ne gère rien', () => {
    expect(peutCreerFormations(gestCMC)).toBe(false)
    expect(cliniquesContenuGerables(gestCMC)).toEqual([])
  })

  it('un gestionnaire autorisé ne gère que sa clinique', () => {
    expect(cliniquesContenuGerables(gestCMCCreateur)).toEqual(['CMC'])
  })

  it('un employé ne gère aucun contenu', () => {
    expect(cliniquesContenuGerables(employeCMC)).toEqual([])
    expect(cliniquesContenuGerables(employeDeux)).toEqual([])
  })
})

describe('Assigner une formation', () => {
  it("une formation du WSSC ne peut pas être assignée à un employé du CMC", () => {
    expect(employeConcerneParClinique('CMC', 'WSSC')).toBe(false)
    expect(employeConcerneParClinique('WSSC', 'CMC')).toBe(false)
  })

  it('une formation commune peut être assignée à tout le monde', () => {
    expect(employeConcerneParClinique('CMC', 'LES_DEUX')).toBe(true)
    expect(employeConcerneParClinique(null, 'LES_DEUX')).toBe(true)
  })

  it('un employé des deux cliniques peut recevoir les formations des deux', () => {
    expect(employeConcerneParClinique('LES_DEUX', 'CMC')).toBe(true)
    expect(employeConcerneParClinique('LES_DEUX', 'WSSC')).toBe(true)
  })

  it("un employé sans clinique ne reçoit pas une formation propre à une clinique", () => {
    expect(employeConcerneParClinique(null, 'CMC')).toBe(false)
  })
})

describe('Espace employé (CMC / WSSC)', () => {
  it("un employé du CMC reste dans l'espace CMC même si le cookie demande le WSSC", () => {
    expect(espaceActif('CMC', 'employe', 'WSSC')).toBe('CMC')
    expect(espacesPossibles('CMC', 'employe')).toEqual(['CMC'])
  })

  it("l'espace CMC n'affiche jamais de contenu du WSSC", () => {
    expect(cliniquesContenuDeLEspace('CMC')).not.toContain('WSSC')
  })

  it("un employé des deux cliniques choisit son espace (CMC par défaut, valeur invalide ignorée)", () => {
    expect(espaceActif('LES_DEUX', 'employe', 'WSSC')).toBe('WSSC')
    expect(espaceActif('LES_DEUX', 'employe', null)).toBe('CMC')
    expect(espaceActif('LES_DEUX', 'employe', 'AUTRE')).toBe('CMC')
  })

  it("l'admin global peut ouvrir les deux espaces", () => {
    expect(espacesPossibles(null, 'super_admin')).toEqual(['CMC', 'WSSC'])
  })

  it("un employé sans clinique n'a aucun espace et ne voit que les contenus communs", () => {
    expect(espaceActif(null, 'employe', 'CMC')).toBeNull()
    expect(cliniquesContenuDeLEspace(null)).toEqual(['LES_DEUX'])
  })
})

describe('Données des employés', () => {
  const cibleWSSC = { id: 'x', role: 'employe', clinique: 'WSSC', departement_id: 'dept-bloc' }
  const cibleCMC = { id: 'y', role: 'employe', clinique: 'CMC', departement_id: 'dept-bloc' }

  it("un admin du CMC ne voit pas le dossier d'un employé du WSSC", () => {
    expect(peutVoirEmploye(adminCMC, cibleWSSC)).toBe(false)
    expect(peutVoirEmploye(adminCMC, cibleCMC)).toBe(true)
  })

  it("un gestionnaire ne voit que son département, dans sa clinique", () => {
    expect(peutVoirEmploye(gestCMC, cibleCMC)).toBe(true)
    expect(peutVoirEmploye(gestCMC, cibleWSSC)).toBe(false)
    expect(peutVoirEmploye(gestCMC, { ...cibleCMC, departement_id: 'autre' })).toBe(false)
  })

  it('un employé ne voit le dossier de personne', () => {
    expect(peutVoirEmploye(employeCMC, cibleCMC)).toBe(false)
  })

  it("un admin de clinique ne gère ni l'admin global, ni un admin des deux cliniques, ni son propre compte", () => {
    expect(peutGererEmploye(adminCMC, { id: 'z', role: 'super_admin', clinique: null })).toBe(false)
    expect(peutGererEmploye(adminCMC, { id: 'z', role: 'admin', clinique: 'LES_DEUX' })).toBe(false)
    expect(peutGererEmploye(adminCMC, { id: adminCMC.id, role: 'admin', clinique: 'CMC' })).toBe(false)
  })

  it("un admin du CMC ne peut pas créer d'employé au WSSC ni nommer d'admin global", () => {
    expect(cliniquesAttribuables(adminCMC)).not.toContain('WSSC')
    expect(rolesAttribuables(adminCMC)).not.toContain('super_admin')
  })

  // Faux constructeur de requête : enregistre les filtres appliqués
  function requete() {
    const filtres: [string, string, unknown][] = []
    const q = {
      filtres,
      eq(col: string, v: unknown) { filtres.push(['eq', col, v]); return q },
      in(col: string, v: unknown) { filtres.push(['in', col, v]); return q },
    }
    return q
  }

  it("la liste des employés d'un admin du CMC exclut le WSSC", () => {
    const q = filtrerEmployes(requete(), adminCMC)
    expect(q.filtres).toEqual([['in', 'clinique', ['CMC', 'LES_DEUX']]])
  })

  it("la liste des employés est vide pour un employé ou un gestionnaire sans département", () => {
    expect(filtrerEmployes(requete(), employeCMC).filtres[0]).toEqual(['eq', 'id', '00000000-0000-0000-0000-000000000000'])
    const gestSansDept = acteur({ role: 'gestionnaire', clinique: 'CMC' })
    expect(filtrerEmployes(requete(), gestSansDept).filtres[0][1]).toBe('id')
  })

  it("l'admin global n'a aucun filtre", () => {
    expect(filtrerEmployes(requete(), superAdmin).filtres).toEqual([])
  })
})

describe('Politiques', () => {
  it("une politique du CMC ne s'adresse jamais à un employé du WSSC", () => {
    expect(estVise({ clinique: 'CMC', departements: [] }, employeWSSC)).toBe(false)
    expect(estVise({ clinique: 'CMC', departements: [] }, employeCMC)).toBe(true)
  })

  it('une politique ciblant un département ne vise que ce département', () => {
    expect(estVise({ clinique: 'CMC', departements: ['dept-bloc'] }, employeCMC)).toBe(true)
    expect(estVise({ clinique: 'CMC', departements: ['autre'] }, employeCMC)).toBe(false)
  })
})
