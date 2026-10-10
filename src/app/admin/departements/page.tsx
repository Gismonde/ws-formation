import { redirect } from 'next/navigation'
import { getActeur, serviceClient, departementsVisibles, cliniquesAdministrees } from '@/lib/permissions'
import { estAdministrateur } from '@/lib/cliniques'
import DepartementsClient from './DepartementsClient'

export default async function DepartementsPage() {
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!estAdministrateur(acteur.role)) redirect('/admin')

  const sb = serviceClient()
  const departements = await departementsVisibles(acteur, sb)
  const ids = departements.map(d => d.id)
  const { data: employes } = ids.length
    ? await sb.from('employes').select('departement_id').in('departement_id', ids).or('actif.is.null,actif.eq.true')
    : { data: [] as { departement_id: string }[] }
  const effectifs: Record<string, number> = {}
  for (const e of employes ?? []) effectifs[e.departement_id] = (effectifs[e.departement_id] ?? 0) + 1

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', margin: 0 }}>Départements</h1>
        <p style={{ color: '#6b7280', fontSize: '14px', margin: '4px 0 0' }}>
          Chaque département appartient à une clinique. Les gestionnaires ne voient que les employés de leur département.
        </p>
      </div>
      <DepartementsClient
        departements={departements.map(d => ({ ...d, effectif: effectifs[d.id] ?? 0 }))}
        cliniques={cliniquesAdministrees(acteur)}
        estSuperAdmin={acteur.role === 'super_admin'}
      />
    </div>
  )
}
