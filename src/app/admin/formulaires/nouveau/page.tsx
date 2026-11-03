import { redirect } from 'next/navigation'
import { getActeur, serviceClient } from '@/lib/permissions'
import { peutCreerFormulaires, cliniquesFormulairePossibles } from '@/lib/formulaires'
import EditeurFormulaire from '@/components/formulaires/EditeurFormulaire'

export default async function NouveauFormulairePage() {
  const a = await getActeur()
  if (!a || !peutCreerFormulaires(a)) redirect('/admin/formulaires')
  const cliniques = cliniquesFormulairePossibles(a)
  // Tous les admins (filtrés par clinique dans l'éditeur)
  const { data: admins } = await serviceClient().from('employes').select('id, prenom, nom, role, clinique, actif').in('role', ['admin', 'super_admin']).or('actif.is.null,actif.eq.true').order('prenom')
  return (
    <EditeurFormulaire id={null} cliniques={cliniques} personnes={(admins ?? []).filter(p => p.id !== a.id)} createurNom={`${a.prenom ?? ''} ${a.nom ?? ''}`.trim()}
      initial={{ titre: '', code: null, description: null, instructions: null, clinique: cliniques[0], destinataire_id: null, actif: false,
        champs: [{ id: 's1', type: 'section', libelle: 'Section 1' }, { id: 'q1', type: 'texte', libelle: '', obligatoire: true }] }} />
  )
}
