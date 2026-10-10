import { redirect } from 'next/navigation'
import NouvelEmployeForm from './NouvelEmployeForm'
import { getActeur, departementsVisibles, rolesAttribuables, cliniquesAttribuables } from '@/lib/permissions'
import { aAccesAdmin } from '@/lib/cliniques'

export default async function NouvelEmployePage() {
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!aAccesAdmin(acteur.role)) redirect('/dashboard')
  if (acteur.role === 'gestionnaire' && (!acteur.departement_id || !acteur.clinique)) redirect('/admin/employes')

  const departements = await departementsVisibles(acteur)
  const cliniques = cliniquesAttribuables(acteur)

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <a href="/admin/employes" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          ← Retour aux employés
        </a>
        <h1 className="text-2xl font-bold text-gray-900 mt-3">Créer un employé</h1>
        <p className="text-gray-500 text-sm mt-1">Créer un nouveau compte employé</p>
      </div>
      <NouvelEmployeForm
        departements={departements}
        rolesPossibles={rolesAttribuables(acteur)}
        cliniquesPossibles={cliniques}
        estGestionnaire={acteur.role === 'gestionnaire'}
        cliniqueParDefaut={acteur.role === 'gestionnaire' ? acteur.clinique ?? '' : cliniques.length === 2 ? cliniques[0] : ''}
        departementParDefaut={acteur.role === 'gestionnaire' ? acteur.departement_id ?? '' : ''}
      />
    </div>
  )
}
