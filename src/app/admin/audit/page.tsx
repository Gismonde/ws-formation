import { redirect } from 'next/navigation'
import { getActeur, serviceClient, filtrerEmployes, departementsVisibles, cliniquesAdministrees } from '@/lib/permissions'
import { estAdministrateur } from '@/lib/cliniques'
import JournalAudit from './JournalAudit'

export default async function AuditPage() {
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!estAdministrateur(acteur.role)) redirect('/admin')
  const sb = serviceClient()
  const [{ data: employes }, departements] = await Promise.all([
    filtrerEmployes(sb.from('employes').select('id, prenom, nom, email, clinique, departement_id, actif').order('nom'), acteur),
    departementsVisibles(acteur, sb),
  ])
  return (
    <JournalAudit
      employes={(employes ?? []).map((e: Record<string, unknown>) => ({
        id: e.id as string, nom: `${e.prenom ?? ''} ${e.nom ?? ''}`.trim(), email: (e.email as string) ?? '',
        clinique: (e.clinique as string | null) ?? null, departement_id: (e.departement_id as string | null) ?? null, actif: e.actif !== false,
      }))}
      departements={departements.map(d => ({ id: d.id, nom: d.nom }))}
      cliniques={cliniquesAdministrees(acteur)}
    />
  )
}
