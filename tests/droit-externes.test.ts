import { describe, it, expect } from 'vitest'
import { filtrerEmployes, peutVoirEmploye, peutGererEmploye, peutSuivreEmployes, type Acteur } from '@/lib/permissions'
import { droitsAEnregistrer, droitsDe } from '@/lib/droits'
import { aAccesAdmin } from '@/lib/cliniques'

const base: Acteur = { id: 'g', auth_user_id: 'u', prenom: null, nom: null, email: null, role: 'gestionnaire', clinique: 'CMC', departement_id: 'd1', peut_creer_formations: false }
const gExt: Acteur = { ...base, peut_assigner_externes: true }
const gExtSuivi: Acteur = { ...gExt, peut_suivre_employes: true }
const gWssc: Acteur = { ...gExt, clinique: 'WSSC' }
const req = () => { const f: unknown[] = []; const q = { f, eq: (...x: unknown[]) => (f.push(['eq', ...x]), q), in: (...x: unknown[]) => (f.push(['in', ...x]), q), or: (...x: unknown[]) => (f.push(['or', ...x]), q) }; return q }

describe('droit « assigner aux membres externes »', () => {
  it('donne accès à l’admin et au suivi, dans les deux cliniques', () => {
    expect(peutSuivreEmployes(gExt)).toBe(true)
    expect(aAccesAdmin({ role: 'gestionnaire', peut_assigner_externes: true })).toBe(true)
    expect(peutSuivreEmployes(gWssc)).toBe(true)
  })
  it('voit les membres externes de sa clinique (tous départements), pas les employés internes', () => {
    expect(peutVoirEmploye(gExt, { role: 'employe', clinique: 'CMC', departement_id: 'd9', externe: true })).toBe(true)
    expect(peutVoirEmploye(gExt, { role: 'employe', clinique: 'CMC', departement_id: 'd1', externe: false })).toBe(false)
    expect(peutVoirEmploye(gWssc, { role: 'employe', clinique: 'CMC', externe: true })).toBe(false)
    expect(peutVoirEmploye(gWssc, { role: 'employe', clinique: 'WSSC', externe: true })).toBe(true)
  })
  it('ne peut pas modifier la fiche d’un membre externe', () => {
    expect(peutGererEmploye(gExtSuivi, { id: 'x', role: 'employe', clinique: 'CMC', departement_id: 'd9', externe: true })).toBe(false)
    expect(peutGererEmploye(gExtSuivi, { id: 'y', role: 'employe', clinique: 'CMC', departement_id: 'd1' })).toBe(true)
  })
  it('liste : externes du CMC, plus son département s’il a le suivi', () => {
    expect(filtrerEmployes(req(), gWssc).f).toEqual([['or', 'and(externe.eq.true,clinique.in.(WSSC,LES_DEUX))']])
    expect(filtrerEmployes(req(), gExt).f).toEqual([['or', 'and(externe.eq.true,clinique.in.(CMC,LES_DEUX))']])
    expect(filtrerEmployes(req(), gExtSuivi).f).toEqual([['or', 'and(externe.eq.true,clinique.in.(CMC,LES_DEUX)),and(departement_id.eq.d1,clinique.in.(CMC,LES_DEUX))']])
  })
  it('droit offert aussi au WSSC', () => {
    expect(droitsAEnregistrer('gestionnaire', { peut_assigner_externes: true }, undefined, 'WSSC').peut_assigner_externes).toBe(true)
    expect(droitsAEnregistrer('gestionnaire', { peut_assigner_externes: true }, undefined, 'CMC').peut_assigner_externes).toBe(true)
    expect(droitsDe({ peut_assigner_externes: true }).peut_assigner_externes).toBe(true)
  })
})
