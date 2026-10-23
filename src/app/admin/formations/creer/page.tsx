// Assistant de création d'une formation : choix du point de départ.
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActeur, peutCreerFormations, serviceClient, cliniquesContenuVisibles, cliniquesContenuGerables } from '@/lib/permissions'
import { i18n } from '@/lib/i18n/serveur'
import CopierExistante from './CopierExistante'

export default async function CreerFormationPage() {
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!peutCreerFormations(acteur)) redirect('/admin/formations')
  const { t } = await i18n()
  const { data: formations } = await serviceClient().from('formations').select('id, titre, clinique').is('copie_de', null)
    .in('clinique', cliniquesContenuVisibles(acteur)).order('titre')

  const departs = [
    { href: '/admin/formations/nouvelle', icone: '✏️', titre: t('Partir de zéro'),
      texte: t('Vous construisez la formation vous-même : modules, leçons, vidéos, documents de la librairie et questionnaire.'),
      besoin: t('Idéal pour une formation sur mesure.') },
    { href: '/admin/formations/generer', icone: '📄', titre: t('À partir d’un document'),
      texte: t('Importez une politique ou une procédure (PDF, texte). Les modules et un questionnaire sont proposés automatiquement, vous les vérifiez avant de créer.'),
      besoin: t('Fichier .pdf, .txt ou .md') },
    { href: '/admin/formations/depuis-pp', icone: '📊', titre: t('À partir d’une présentation PowerPoint'),
      texte: t('Importez une présentation : chaque diapositive devient du contenu de formation, que vous pouvez ajuster.'),
      besoin: t('Fichier .ppt ou .pptx') },
  ]

  return (
    <div className="max-w-4xl">
      <Link href="/admin/formations" className="text-sm text-gray-500 hover:text-gray-700">{t('← Retour aux formations')}</Link>
      <h1 className="text-2xl font-bold text-gray-900 mt-3">{t('Nouvelle formation')}</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">{t('Choisissez votre point de départ. Dans tous les cas, vous pourrez compléter la formation dans l’éditeur avant de la publier.')}</p>

      <div className="grid gap-4 md:grid-cols-3">
        {departs.map(d => (
          <Link key={d.href} href={d.href} className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-indigo-400 hover:shadow-md">
            <span className="text-3xl" aria-hidden>{d.icone}</span>
            <span className="mt-3 font-semibold text-gray-900 group-hover:text-indigo-700">{d.titre}</span>
            <span className="mt-2 flex-1 text-sm text-gray-600">{d.texte}</span>
            <span className="mt-4 text-xs text-gray-400">{d.besoin}</span>
            <span className="mt-3 text-sm font-semibold text-indigo-600">{t('Commencer →')}</span>
          </Link>
        ))}
      </div>

      {(formations?.length ?? 0) > 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white p-5">
          <p className="font-semibold text-gray-900">⧉ {t('Ou copier une formation existante')}</p>
          <p className="text-sm text-gray-500 mt-1 mb-3">{t('Modules, leçons, contenus et questionnaire sont copiés dans un nouveau brouillon.')}</p>
          <CopierExistante formations={(formations ?? []) as { id: string; titre: string; clinique: 'CMC' | 'WSSC' | 'LES_DEUX' }[]} cliniques={cliniquesContenuGerables(acteur)} />
        </div>
      )}
    </div>
  )
}
