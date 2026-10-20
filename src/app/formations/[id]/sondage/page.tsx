import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getActeur, serviceClient } from '@/lib/permissions'
import { etatSondage } from '@/lib/sondages'
import FormulaireSondage from './FormulaireSondage'

export default async function SondagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  const sb = serviceClient()
  const { data: formation } = await sb.from('formations').select('id, titre, publiee').eq('id', id).maybeSingle()
  if (!formation || !formation.publiee) notFound()
  const etat = await etatSondage(sb, acteur.id, id)

  const message = {
    inactif: 'Aucun sondage n’est proposé pour cette formation.',
    pas_encore: 'Le sondage sera disponible une fois la formation terminée.',
    repondu: 'Vous avez déjà donné votre avis sur cette formation. Merci !',
  } as const

  return (
    <div className="min-h-screen" style={{ background: 'var(--fond-clinique, #f9fafb)' }}>
      <nav className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="max-w-2xl mx-auto">
          <Link href={`/formations/${id}`} className="text-gray-500 hover:text-gray-900 text-sm">← {formation.titre}</Link>
        </div>
      </nav>
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900">Votre avis sur la formation</h1>
        <p className="text-gray-600 mt-1 mb-6">« {formation.titre} » — 1 minute, 5 questions.</p>
        {etat === 'a_repondre' ? <FormulaireSondage formationId={id} /> : (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-600">{message[etat]}</div>
        )}
      </main>
    </div>
  )
}
