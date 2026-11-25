import { describe, it, expect } from 'vitest'
import { peutModifierFormation, estValidateurEnCours } from '@/lib/droits-formation'

const gest = { id: 'g', role: 'gestionnaire' as const, clinique: 'WSSC' as const, vue: null, peut_creer_formations: false, peut_valider_formations: true }
const f = (o: object = {}) => ({ clinique: 'WSSC', creee_par: 'autre', validateur_id: 'g', statut_validation: 'en_validation', ...o })

describe('Le validateur désigné corrige la formation en validation', () => {
  it('peut modifier pendant la validation, même sans droit de création', () => {
    expect(peutModifierFormation(gest, f())).toBe(true)
    expect(estValidateurEnCours(gest, f())).toBe(true)
  })
  it('plus après la décision, ni si un autre est désigné', () => {
    expect(peutModifierFormation(gest, f({ statut_validation: 'approuvee' }))).toBe(false)
    expect(peutModifierFormation(gest, f({ statut_validation: 'a_modifier' }))).toBe(false)
    expect(peutModifierFormation(gest, f({ validateur_id: 'x' }))).toBe(false)
  })
  it('sans droit de validation, ou hors de sa clinique : non', () => {
    expect(peutModifierFormation({ ...gest, peut_valider_formations: false }, f())).toBe(false)
    expect(peutModifierFormation(gest, f({ clinique: 'CMC' }))).toBe(false)
  })
  it('un gestionnaire créateur garde ses propres formations', () => {
    expect(peutModifierFormation({ ...gest, peut_creer_formations: true }, f({ creee_par: 'g', validateur_id: null, statut_validation: 'brouillon' }))).toBe(true)
  })
})

describe('Validateur : questionnaire et librairie', () => {
  it("les routes de l'éditeur ne demandent pas le droit de créer (peutGererContenu) en plus de peutModifierFormation", async () => {
    const { readFileSync } = await import('node:fs')
    for (const f of ['src/app/api/admin/formations/[id]/questionnaire/route.ts', 'src/app/api/admin/formations/[id]/brancher-librairie/route.ts']) {
      const src = readFileSync(f, 'utf8')
      expect(src).toContain('peutModifierFormation(acteur, f)')
      expect(src).not.toContain('peutGererContenu(')
    }
  })
})
