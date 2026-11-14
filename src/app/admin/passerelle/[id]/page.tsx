import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { i18n } from '@/lib/i18n/serveur'
import { getActeur, serviceClient } from '@/lib/permissions'
import { signerUrlsMedias } from '@/lib/medias-serveur'
import { peutGererPasserelle, CLINIQUE_PASSERELLE, type Edition } from '@/lib/passerelle'
import EditionForm from './EditionForm'

export const dynamic = 'force-dynamic'

// Ajouter (id = « nouvelle ») ou modifier une édition de La Passerelle.
export default async function EditionAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { t } = await i18n()
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!peutGererPasserelle(acteur)) redirect('/admin')
  let edition: Edition | null = null
  if (id !== 'nouvelle') {
    const { data } = await serviceClient().from('passerelle_editions').select('*').eq('id', id).eq('clinique', CLINIQUE_PASSERELLE).maybeSingle()
    if (!data) notFound()
    edition = data as Edition
  }
  const urls = edition ? await signerUrlsMedias([edition.couverture]) : {}
  return (
    <div className="max-w-4xl">
      <Link href="/admin/passerelle" className="text-sm text-gray-500 hover:text-gray-800">← {t('La Passerelle')}</Link>
      <h1 className="text-2xl font-bold text-gray-900 mt-2 mb-6">{edition ? t('Édition {n}', { n: edition.numero }) : t('Nouvelle édition')}</h1>
      <EditionForm edition={edition} apercuCouverture={edition ? urls[edition.couverture] ?? null : null} />
    </div>
  )
}
