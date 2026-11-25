import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActeur, serviceClient } from '@/lib/permissions'
import { estAdminCommunications, type Theme } from '@/lib/communications'
import ImportLot from './ImportLot'

export const dynamic = 'force-dynamic'

// Administration → Affiches, guides & consentements → Importer en lot (dossier complet ou ZIP, glisser-déposer).
export default async function ImportPage() {
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!estAdminCommunications(acteur)) redirect('/admin')
  const sb = serviceClient()
  const [{ data: themes }, { data: departements }, { data: existants }] = await Promise.all([
    sb.from('themes_documents').select('id, nom, parent_id'),
    sb.from('departements').select('id, nom').in('nom', ['Administration', 'Recherche et Innovation']),
    sb.from('communications').select('titre, categorie'),
  ])
  return (
    <div className="max-w-4xl">
      <Link href="/admin/communications" className="text-sm text-indigo-700 hover:underline">← Affiches, guides & consentements</Link>
      <h1 className="text-2xl font-bold text-gray-900 mt-2">Importer en lot</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">Déposez le dossier complet ou le fichier ZIP des guides et consentements. Chaque document est reconnu par son contenu, classé et publié automatiquement (sans courriel). Les doublons et les documents déjà publiés sont ignorés.</p>
      <ImportLot themes={(themes ?? []) as Theme[]} departements={(departements ?? []).map(d => d.id)}
        existants={(existants ?? []).map(e => `${e.categorie}|${e.titre}`)} />
    </div>
  )
}
