// Demandes d'accès : traitées depuis la version française, même quand l'employé a demandé la version anglaise,
// et visibles au tableau de bord admin. Vérifications statiques des routes et pages.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

const lire = (p: string) => readFileSync(p, 'utf8')

describe('demandes d’accès et versions FR / EN', () => {
  it('la liste des demandes couvre toute la famille de versions', () => {
    const s = lire('src/lib/formations-libres.ts')
    expect(s).toMatch(/\.in\('formation_id', versions\.famille\(formationId\)\)/)
  })
  it('la décision accepte une demande de l’autre version, de la même clinique seulement', () => {
    const s = lire('src/app/api/admin/formations/[id]/demandes/route.ts')
    expect(s).toMatch(/versions\.famille\(id\)/)
    expect(s).toMatch(/cible\.clinique \?\? 'LES_DEUX'\) !== \(f\.clinique \?\? 'LES_DEUX'\)/)
    expect(s).toMatch(/inscrireVolontaire\(sb, d\.employe_id, cibleId/)
    expect(s).toMatch(/peutTraiterDemandes\(moi, f\)/)
  })
  it('le tableau de bord admin affiche les demandes en attente que l’acteur peut traiter', () => {
    expect(lire('src/app/admin/page.tsx')).toMatch(/demandesEnAttente\(sb, acteur\)/)
    expect(lire('src/lib/formations-libres.ts')).toMatch(/peutTraiterDemandes\(a, f\) \|\| peutTraiterDemandes\(a, fr\)/)
  })
})
