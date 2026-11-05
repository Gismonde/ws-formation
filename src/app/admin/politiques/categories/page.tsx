// Gestion des catégories de rangement des politiques (code MED / CON…, nom, départements associés).
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActeur, serviceClient } from '@/lib/permissions'
import { peutPublierPolitiques, categoriesPolitiques } from '@/lib/politiques'
import { i18n } from '@/lib/i18n/serveur'
import GestionCategories from './GestionCategories'

export const dynamic = 'force-dynamic'

export default async function CategoriesPolitiquesPage() {
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!peutPublierPolitiques(acteur)) redirect('/admin/politiques')
  const { t } = await i18n()
  const sb = serviceClient()
  const [categories, { data: deps }, { data: pols }] = await Promise.all([
    categoriesPolitiques(sb),
    sb.from('departements').select('id, nom').order('nom'),
    sb.from('politiques').select('*').eq('actif', true),
  ])
  const nombres: Record<string, number> = {}
  for (const p of (pols ?? []) as { categorie_id?: string | null }[]) if (p.categorie_id) nombres[p.categorie_id] = (nombres[p.categorie_id] ?? 0) + 1
  return (
    <div className="max-w-3xl">
      <Link href="/admin/politiques" className="text-sm text-indigo-600 hover:underline">{t('← Politiques')}</Link>
      <h1 className="mt-2 text-2xl font-bold text-gray-900">🗂️ {t('Catégories de politiques')}</h1>
      <p className="mb-6 mt-1 text-sm text-gray-500">{t('Rangez les politiques par code (MED, CON, CHU…). Les départements associés à une catégorie sont ajoutés automatiquement au public des politiques qu’on y range.')}</p>
      <GestionCategories categories={categories} departements={(deps ?? []) as { id: string; nom: string }[]} nombres={nombres} />
    </div>
  )
}
