import { redirect, notFound } from 'next/navigation'
import { getActeur, serviceClient, peutCreerFormations, peutVoirContenu } from '@/lib/permissions'
import CertificatPDF from '@/components/CertificatPDF'

// Aperçu du certificat d'une formation pour les gestionnaires et administrateurs qui créent des formations :
// même gabarit que le vrai certificat, avec un nom, une date et un numéro d'exemple.
export default async function ApercuCertificatPage({ params }: { params: Promise<{ formationId: string }> }) {
  const { formationId } = await params
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!peutCreerFormations(acteur)) redirect('/dashboard/accueil')

  const { data: f } = await serviceClient().from('formations')
    .select('*').eq('id', formationId).maybeSingle()
  if (!f || !peutVoirContenu(acteur, f.clinique)) notFound()

  const aujourdhui = new Date()
  let expiration: string | null = null
  if (f.validite_mois && f.validite_mois > 0) {
    const d = new Date(aujourdhui)
    d.setMonth(d.getMonth() + f.validite_mois)
    expiration = d.toISOString().slice(0, 10)
  }

  return (
    <CertificatPDF
      apercu
      certificat={{
        id: 'apercu', numero_certificat: 'CERT-APERCU', date_emission: aujourdhui.toISOString(),
        date_expiration: expiration, note_finale: 100, valide: true,
        formations: { titre: f.titre, categorie: f.categorie, niveau: f.niveau, description: f.description, responsable_formation: f.responsable_formation ?? null },
      }}
      employe={{ id: 'apercu', prenom: 'Prénom', nom: 'Nom de l’employé', departement: 'Département' }}
      clinique={f.clinique ?? null}
      retour={{ href: `/admin/formations/${f.id}`, libelle: f.titre }}
    />
  )
}
