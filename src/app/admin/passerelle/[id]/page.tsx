import { redirect } from 'next/navigation'

// Les éditions se gèrent maintenant depuis le portail (La Passerelle → Gérer).
export default async function EditionAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/dashboard/passerelle/gestion/${id}`)
}
