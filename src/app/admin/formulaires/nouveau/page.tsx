import { redirect } from 'next/navigation'
import { getActeur, serviceClient } from '@/lib/permissions'
import { peutCreerFormulaires, CLINIQUE_FORMULAIRES } from '@/lib/formulaires'
import { destinatairesPossibles } from '@/lib/formulaires-serveur'
import EditeurFormulaire from '@/components/formulaires/EditeurFormulaire'

export default async function NouveauFormulairePage() {
  const a = await getActeur()
  if (!a || !peutCreerFormulaires(a)) redirect('/admin/formulaires')
  const { personnes, departements } = await destinatairesPossibles(serviceClient())
  return (
    <EditeurFormulaire id={null} personnes={personnes.filter(p => p.id !== a.id)} departements={departements} createurNom={`${a.prenom ?? ''} ${a.nom ?? ''}`.trim()}
      initial={{ titre: '', code: null, description: null, instructions: null, clinique: CLINIQUE_FORMULAIRES, actif: false, destinataires: [], anonyme_permis: false, message_anonymat: null,
        champs: [{ id: 's1', type: 'section', libelle: 'Section 1' }, { id: 'q1', type: 'texte', libelle: '', obligatoire: true }] }} />
  )
}
