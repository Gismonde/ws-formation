import { redirect, notFound } from 'next/navigation'
import { getActeur, serviceClient, peutVoirEmploye } from '@/lib/permissions'
import { aAccesAdmin } from '@/lib/cliniques'
import { logAudit } from '@/lib/audit'
import CertificatPDF from '@/components/CertificatPDF'

interface PageProps {
  params: Promise<{ id: string }>
}

// Certificat : visible par l'employé concerné, et par les gestionnaires / administrateurs
// qui ont accès au dossier de cet employé (même règle que la fiche employé).
export default async function CertificatPage({ params }: PageProps) {
  const { id } = await params
  const acteur = await getActeur()
  if (!acteur) redirect('/login')

  const sb = serviceClient()
  const { data: cert } = await sb
    .from('certificats')
    .select('*, formations(titre, categorie, niveau, description, responsable_formation)')
    .eq('id', id)
    .eq('valide', true)
    .maybeSingle()
  if (!cert) notFound()

  const { data: employe } = await sb
    .from('employes')
    .select('id, prenom, nom, departement, clinique, departement_id, role, departements(nom)')
    .eq('id', cert.employe_id)
    .single()
  if (!employe) notFound()

  const proprietaire = employe.id === acteur.id
  if (!proprietaire && !(aAccesAdmin(acteur) && peutVoirEmploye(acteur, employe))) notFound()

  if (!proprietaire) {
    await logAudit({
      acteur_id: acteur.id, cible_employe_id: employe.id, formation_id: cert.formation_id,
      type_action: 'CONSULTATION_DOSSIER',
      description: `Consultation du certificat ${cert.numero_certificat} de ${employe.prenom} ${employe.nom}`,
      metadata: { certificat_id: cert.id },
    })
  }

  return (
    <CertificatPDF
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      certificat={cert as any}
      employe={{
        id: employe.id,
        prenom: employe.prenom,
        nom: employe.nom,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        departement: (employe as any).departements?.nom ?? employe.departement ?? null,
      }}
      clinique={employe.clinique ?? null}
      retour={proprietaire ? undefined : { href: `/admin/employes/${employe.id}?onglet=certificats`, libelle: `Dossier de ${employe.prenom} ${employe.nom}` }}
    />
  )
}
