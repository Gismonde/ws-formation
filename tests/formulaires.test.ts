import { describe, it, expect } from 'vitest'
import {
  peutCreerFormulaires, peutVoirReponses, peutModifierFormulaire, formulairePourEmploye, voitTout, estDestinataire, droitFormulairesPossible,
  nettoyerChamps, validerReponses, champsAvecReserve, valeursPreremplies, valeurLisible, CLE_AUTRE, type Champ,
} from '@/lib/formulaires'
import type { Acteur } from '@/lib/permissions'

const base = { auth_user_id: 'u', prenom: 'A', nom: 'B', email: 'a@b.c', departement_id: null, peut_creer_formations: true }
const sa: Acteur = { ...base, id: 'sa', role: 'super_admin', clinique: null }
const adminWSSC: Acteur = { ...base, id: 'ad', role: 'admin', clinique: 'WSSC' }
const adminAutorise: Acteur = { ...adminWSSC, id: 'ad2', peut_creer_formulaires: true }
const gest: Acteur = { ...base, id: 'g', role: 'gestionnaire', clinique: 'WSSC', peut_creer_formulaires: true }

describe('droits des formulaires', () => {
  it('seuls l’admin global et les admins / gestionnaires autorisés du WSSC créent des formulaires', () => {
    expect(peutCreerFormulaires(sa)).toBe(true)
    expect(peutCreerFormulaires(adminWSSC)).toBe(false)
    expect(peutCreerFormulaires(adminAutorise)).toBe(true)
    expect(peutCreerFormulaires(gest)).toBe(true)
    expect(peutCreerFormulaires({ ...adminAutorise, clinique: 'CMC' })).toBe(false)
    expect(peutCreerFormulaires({ ...gest, clinique: 'CMC' })).toBe(false)
  })

  it('administrateurs : tout ; gestionnaires : seulement les formulaires qui leur sont assignés', () => {
    const gestDept: Acteur = { ...base, id: 'gd', role: 'gestionnaire', clinique: 'WSSC', departement_id: 'bloc' }
    const f = { cree_par: 'ad2', destinataire_id: null, clinique: 'WSSC' as const, destinataires: [{ type: 'departement' as const, id: 'bloc' }, { type: 'employe' as const, id: 'p1' }] }
    expect(peutVoirReponses(adminWSSC, f)).toBe(true) // admin du WSSC : tout
    expect(voitTout(adminWSSC, f)).toBe(true)
    expect(peutVoirReponses(gestDept, f)).toBe(true) // gestionnaire du département désigné
    expect(voitTout(gestDept, f)).toBe(false) // … sans les statuts
    expect(peutVoirReponses({ ...gestDept, departement_id: 'autre' }, f)).toBe(false)
    expect(peutVoirReponses({ ...gest, id: 'p1' }, f)).toBe(true) // personne désignée
    expect(peutVoirReponses({ ...adminWSSC, clinique: 'CMC' }, f)).toBe(false)
    expect(estDestinataire(adminAutorise, { cree_par: 'ad2', destinataire_id: null, destinataires: [] })).toBe(true) // aucun destinataire : le créateur
  })

  it('le droit « Gestion des formulaires » : admin ou gestionnaire du WSSC seulement', () => {
    expect(droitFormulairesPossible('gestionnaire', 'WSSC')).toBe(true)
    expect(droitFormulairesPossible('admin', 'LES_DEUX')).toBe(true)
    expect(droitFormulairesPossible('admin', 'CMC')).toBe(false)
    expect(droitFormulairesPossible('employe', 'WSSC')).toBe(false)
  })

  it('seul le créateur (ou l’admin global) modifie le formulaire', () => {
    expect(peutModifierFormulaire(adminAutorise, { cree_par: 'ad2', clinique: 'WSSC' })).toBe(true)
    expect(peutModifierFormulaire(adminWSSC, { cree_par: 'ad2', clinique: 'WSSC' })).toBe(false)
    expect(peutModifierFormulaire(sa, { cree_par: 'ad2', clinique: 'WSSC' })).toBe(true)
  })

  it('un formulaire WSSC actif est proposé dans l’espace WSSC seulement', () => {
    expect(formulairePourEmploye({ clinique: 'WSSC', actif: true, archive: false }, 'WSSC', 'WSSC')).toBe(true)
    expect(formulairePourEmploye({ clinique: 'WSSC', actif: true, archive: false }, 'CMC', 'LES_DEUX')).toBe(false)
    expect(formulairePourEmploye({ clinique: 'WSSC', actif: false, archive: false }, 'WSSC', 'WSSC')).toBe(false)
  })
})

const champs: Champ[] = [
  { id: 's1', type: 'section', libelle: 'Section 1' },
  { id: 'nom', type: 'texte', libelle: 'Nom', obligatoire: true, prerempli: 'nom' },
  { id: 'type', type: 'choix_multiple', libelle: 'Type', options: ['Chute', 'Erreur'], autre: true, obligatoire: true },
  { id: 'd', type: 'date', libelle: 'Date' },
  { id: 'avises', type: 'tableau', libelle: 'Personnes avisées', colonnes: ['Date', 'Heure'], lignes: ['Chef', 'RPRP'] },
  { id: 'sig', type: 'signature', libelle: 'Signature', obligatoire: true },
  { id: 's8', type: 'section', libelle: 'Réservé RPRP', reserve: true },
  { id: 'classe', type: 'choix_unique', libelle: 'Classification', options: ['Faible', 'Élevé'] },
]

describe('réponses', () => {
  it('hérite la réserve de la section', () => {
    expect(champsAvecReserve(champs).find(c => c.id === 'classe')!.estReserve).toBe(true)
    expect(champsAvecReserve(champs).find(c => c.id === 'nom')!.estReserve).toBe(false)
  })

  it('valide les champs obligatoires et « Autre »', () => {
    expect(validerReponses(champs, {}, 'employe')).toEqual({ erreur: '« Nom » est obligatoire' })
    expect(validerReponses(champs, { nom: 'X', type: ['__autre__'], sig: { nom: 'X' } }, 'employe')).toEqual({ erreur: '« Type » : précisez « Autre »' })
    const ok = validerReponses(champs, { nom: 'X', type: ['Chute', 'Pirate'], [CLE_AUTRE('type')]: 'ignoré', sig: { nom: 'X Y' }, classe: 'Élevé', d: '2026-11-03' }, 'employe')
    expect('valeurs' in ok).toBe(true)
    if ('valeurs' in ok) {
      expect(ok.valeurs.type).toEqual(['Chute'])
      expect(ok.valeurs.classe).toBeUndefined() // réservé : jamais rempli par l'employé
      expect(ok.valeurs[CLE_AUTRE('type')]).toBeUndefined()
      expect((ok.valeurs.sig as { nom: string }).nom).toBe('X Y')
    }
  })

  it('refuse une date mal formée et un choix inconnu', () => {
    expect(validerReponses(champs, { nom: 'X', type: ['Chute'], sig: { nom: 'X' }, d: '03/11/2026' }, 'employe')).toEqual({ erreur: '« Date » : date invalide' })
    expect(validerReponses(champs, { classe: 'Moyen' }, 'reserve')).toEqual({ erreur: '« Classification » : choix invalide' })
  })

  it('garde les lignes fixes du tableau', () => {
    const r = validerReponses(champs, { nom: 'X', type: ['Chute'], sig: { nom: 'X' }, avises: [['2026-11-03', '10:00'], ['', '']] }, 'employe')
    expect('valeurs' in r && r.valeurs.avises).toEqual([['2026-11-03', '10:00'], ['', '']])
    expect(valeurLisible(champs[4], { avises: [['2026-11-03', '10:00'], ['', '']] })).toBe('Chef : 2026-11-03 | 10:00\nRPRP :  | ')
  })

  it('envoi anonyme : champs d’identité ignorés (même obligatoires)', () => {
    const r = validerReponses(champs, { nom: 'X', type: ['Chute'], sig: { nom: 'X' } }, 'employe', { anonyme: true })
    expect('valeurs' in r && r.valeurs.nom).toBeUndefined()
    expect('valeurs' in r && r.valeurs.sig).toBeUndefined()
    expect('valeurs' in r && r.valeurs.type).toEqual(['Chute'])
  })

  it('préremplit le nom et la date', () => {
    const v = valeursPreremplies([...champs, { id: 'j', type: 'date', libelle: 'Jour', prerempli: 'aujourdhui' }], { prenom: 'Léa', nom: 'Roy' }, new Date(2026, 10, 3, 9, 5))
    expect(v).toEqual({ nom: 'Léa Roy', j: '2026-11-03' })
  })
})

describe('définition', () => {
  it('nettoie les champs et refuse un choix sans option', () => {
    expect(nettoyerChamps([{ type: 'choix_unique', libelle: 'Q' }])).toEqual({ erreur: '« Q » : ajoutez au moins un choix' })
    const r = nettoyerChamps([{ id: 'a', type: 'texte', libelle: ' Nom ', obligatoire: true, pirate: 1 }, { id: 'a', type: 'info', libelle: '', aide: 'Aide' }])
    expect('champs' in r && r.champs.length).toBe(2)
    if ('champs' in r) {
      expect(r.champs[0]).toEqual({ id: 'a', type: 'texte', libelle: 'Nom', obligatoire: true })
      expect(r.champs[1].id).not.toBe('a')
    }
  })
})
