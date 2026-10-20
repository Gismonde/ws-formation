import { redirect } from 'next/navigation'

// Les preuves sont maintenant un onglet de la fiche employé
export default async function AnciennesPreuves({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/admin/employes/${id}?onglet=preuves`)
}
