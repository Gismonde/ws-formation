import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { i18n } from '@/lib/i18n/serveur'
import { getActeur, serviceClient } from '@/lib/permissions'
import { chargerComites, peutGererComites, CLINIQUE_COMITES, type Comite } from '@/lib/comites'
import ComiteForm from './ComiteForm'

export const dynamic = 'force-dynamic'

// Créer (id = « nouveau ») ou modifier un comité.
export default async function ComiteAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { t } = await i18n()
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!peutGererComites(acteur)) redirect('/admin')
  const sb = serviceClient()
  let comite: Comite | null = null
  if (id !== 'nouveau') {
    const { comites } = await chargerComites(sb, { brouillons: true, id })
    comite = comites[0] ?? null
    if (!comite) notFound()
  }
  // Employés du WSSC proposés comme membres
  const { data: emps } = await sb.from('employes').select('id, prenom, nom, poste').eq('actif', true).in('clinique', [CLINIQUE_COMITES, 'LES_DEUX']).order('nom')
  const employes = (emps ?? []).map(e => ({ id: e.id as string, nom: [e.prenom, e.nom].filter(Boolean).join(' '), poste: (e.poste as string | null) ?? '' }))

  return (
    <div className="max-w-4xl">
      <Link href="/admin/comites" className="text-sm text-gray-500 hover:text-gray-800">← {t('Comités')}</Link>
      <h1 className="text-2xl font-bold text-gray-900 mt-2 mb-6">{comite ? comite.nom : t('Nouveau comité')}</h1>
      <ComiteForm comite={comite} employes={employes} />
    </div>
  )
}
