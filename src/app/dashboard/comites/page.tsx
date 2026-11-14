import Link from 'next/link'
import { redirect } from 'next/navigation'
import { i18n } from '@/lib/i18n/serveur'
import { getActeur, serviceClient } from '@/lib/permissions'
import { getEspace } from '@/lib/espace'
import { chargerComites, couleurDe, peutGererComites, CLINIQUE_COMITES } from '@/lib/comites'

export const dynamic = 'force-dynamic'

// « Apprenez à connaître vos comités » (espace WSSC)
export default async function ComitesPage() {
  const { t } = await i18n()
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  const espace = await getEspace(acteur)
  if (espace.actif !== CLINIQUE_COMITES) redirect('/dashboard/accueil')
  const admin = peutGererComites(acteur)
  const { comites } = await chargerComites(serviceClient(), { brouillons: admin })

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900">{t('Apprenez à connaître vos comités')}</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">{t('Les comités du WSSC : ce qu’ils font, à quoi ils servent et qui en fait partie.')}</p>
      {comites.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">{t('Aucun comité pour l’instant.')}</div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
          {comites.map(c => {
            const k = couleurDe(c.couleur)
            return (
              <Link key={c.id} href={`/dashboard/comites/${c.id}`} className="block bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-shadow" style={{ borderTop: `4px solid ${k.bord}` }}>
                <span className="w-11 h-11 rounded-full flex items-center justify-center text-2xl mb-3" style={{ background: k.fond }}>{c.icone}</span>
                <span className="block font-bold text-gray-900">{c.nom}</span>
                {c.presentation && <span className="block text-sm text-gray-600 mt-1">{c.presentation}</span>}
                <span className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                  👥 {t('{n} membre(s)', { n: c.membres.length })}
                  {!c.publie && <span className="font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{t('Brouillon — visible par les administrateurs seulement')}</span>}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
