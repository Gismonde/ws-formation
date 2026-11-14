import Link from 'next/link'
import { redirect } from 'next/navigation'
import { i18n } from '@/lib/i18n/serveur'
import { getActeur, serviceClient } from '@/lib/permissions'
import { chargerComites, chargerBanniereComites, couleurDe, peutGererComites } from '@/lib/comites'
import BanniereComitesForm from './BanniereComitesForm'

export const dynamic = 'force-dynamic'

// Administration → Comités : liste, brouillons et comités publiés.
export default async function ComitesAdminPage() {
  const { t } = await i18n()
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!peutGererComites(acteur)) redirect('/admin')
  const sb = serviceClient()
  const { comites, migration } = await chargerComites(sb, { brouillons: true })
  const banniere = migration ? null : await chargerBanniereComites(sb)

  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Comités')}</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">{t('La page « Apprenez à connaître vos comités » du portail employé (WSSC). Un comité en brouillon n’est visible que par les administrateurs, dans leur espace employé : publiez-le quand il est prêt.')}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/comites" className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">{t('Voir comme un employé')}</Link>
          {!migration && <Link href="/admin/comites/nouveau" className="text-sm font-semibold px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">+ {t('Nouveau comité')}</Link>}
        </div>
      </div>

      {banniere && (banniere.reglagesAbsents
        ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 mb-6">{t('Bannière de la page d’accueil :')} {t('Exécutez d’abord')} <code>supabase/migrations/comites.sql</code> {t('dans Supabase.')}</div>
        : <BanniereComitesForm banniere={{ titre: banniere.titre, texte: banniere.texte, image: banniere.image }} noms={comites.map(c => c.nom)} />)}

      {migration ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{t('Exécutez d’abord')} <code>supabase/migrations/comites.sql</code> {t('dans Supabase.')}</div>
      ) : comites.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-500">
          {t('Aucun comité pour l’instant.')} <Link href="/admin/comites/nouveau" className="text-indigo-600 hover:underline">{t('Créer le premier comité')}</Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {comites.map(c => {
            const k = couleurDe(c.couleur)
            return (
              <Link key={c.id} href={`/admin/comites/${c.id}`} className="flex items-center gap-4 px-5 py-4 border-b border-gray-100 last:border-0 hover:bg-gray-50">
                {c.image
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={c.image} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                  : <span className="w-12 h-12 rounded-lg shrink-0" style={{ background: `linear-gradient(135deg, ${k.bord}, ${k.texte})` }} />}
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-gray-900">{c.nom}</span>
                  <span className="block text-xs text-gray-500 truncate">{c.presentation || t('Pas encore de présentation')}</span>
                </span>
                <span className="text-xs text-gray-500 whitespace-nowrap">{t('{n} membre(s)', { n: c.membres.length })}</span>
                <span className={'text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ' + (c.publie ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600')}>{c.publie ? t('Publié') : t('Brouillon')}</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
