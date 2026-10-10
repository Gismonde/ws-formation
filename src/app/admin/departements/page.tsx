import { redirect } from 'next/navigation'
import { getActeur, serviceClient, departementsVisibles, filtrerEmployes } from '@/lib/permissions'
import { estAdministrateur, cliniquesDe } from '@/lib/cliniques'
import DepartementsClient from './DepartementsClient'

export default async function DepartementsPage() {
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!estAdministrateur(acteur.role)) redirect('/admin')

  const sb = serviceClient()
  const departements = await departementsVisibles(acteur, sb)

  // Effectifs actifs par département et par clinique (dans le périmètre de l'acteur)
  const { data: employes } = await filtrerEmployes(
    sb.from('employes').select('departement_id, clinique').or('actif.is.null,actif.eq.true'), acteur)
  const effectifs: Record<string, { CMC: number; WSSC: number; sans: number }> = {}
  for (const e of employes ?? []) {
    if (!e.departement_id) continue
    const ligne = (effectifs[e.departement_id] ??= { CMC: 0, WSSC: 0, sans: 0 })
    const cl = cliniquesDe(e.clinique)
    if (cl.length === 0) ligne.sans++
    for (const c of cl) ligne[c]++
  }

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', margin: 0 }}>Départements</h1>
        <p style={{ color: '#6b7280', fontSize: '14px', margin: '4px 0 0' }}>
          Les départements sont communs aux deux cliniques. Chaque employé choisit d&apos;abord sa clinique, puis son département.
          Un gestionnaire ne voit que les employés de son département dans sa clinique.
        </p>
      </div>
      <DepartementsClient
        departements={departements.map(d => ({ id: d.id, nom: d.nom, effectif: effectifs[d.id] ?? { CMC: 0, WSSC: 0, sans: 0 } }))}
        estSuperAdmin={acteur.role === 'super_admin'}
      />
    </div>
  )
}
