import Link from 'next/link'
import { redirect } from 'next/navigation'
import { i18n } from '@/lib/i18n/serveur'
import { getActeur, serviceClient } from '@/lib/permissions'
import { getEspace } from '@/lib/espace'
import { chargerComites, couleurDe, peutGererComites, CLINIQUE_COMITES } from '@/lib/comites'

export const dynamic = 'force-dynamic'

// « Apprenez à connaître vos comités » (espace WSSC) : une carte par comité, avec son image de couverture.
export default async function ComitesPage() {
  const { t } = await i18n()
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  const espace = await getEspace(acteur)
  if (espace.actif !== CLINIQUE_COMITES) redirect('/dashboard/accueil')
  const admin = peutGererComites(acteur)
  const { comites } = await chargerComites(serviceClient(), { brouillons: admin })

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">{t('Apprenez à connaître vos comités')}</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">{t('Les comités du WSSC : ce qu’ils font, à quoi ils servent et qui en fait partie.')}</p>
      {comites.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">{t('Aucun comité pour l’instant.')}</div>
      ) : (
        <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {comites.map(c => {
            const k = couleurDe(c.couleur)
            return (
              <Link key={c.id} href={`/dashboard/comites/${c.id}`} className="group flex flex-col bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
                {c.image
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={c.image} alt="" className="w-full aspect-[4/3] object-cover" />
                  : <span className="block w-full aspect-[4/3]" style={{ background: `linear-gradient(135deg, ${k.bord}, ${k.texte})` }} />}
                <span className="flex flex-col flex-1 p-5" style={{ borderTop: `4px solid ${k.bord}` }}>
                  <span className="font-bold text-gray-900 leading-snug">{c.nom}</span>
                  {c.presentation && <span className="text-sm text-gray-600 mt-2 line-clamp-3">{c.presentation}</span>}
                  <span className="flex items-center justify-between gap-2 mt-auto pt-4 text-xs">
                    <span className="text-gray-500">{t('{n} membre(s)', { n: c.membres.length })}</span>
                    {!c.publie
                      ? <span className="font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{t('Brouillon')}</span>
                      : <span className="font-semibold group-hover:underline" style={{ color: k.texte }}>{t('Découvrir')} →</span>}
                  </span>
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
