import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { i18n } from '@/lib/i18n/serveur'
import { getActeur, serviceClient } from '@/lib/permissions'
import { getEspace } from '@/lib/espace'
import { chargerComites, couleurDe, initiales, peutGererComites, CLINIQUE_COMITES } from '@/lib/comites'

export const dynamic = 'force-dynamic'

// Page d'un comité : description, ce qu'il fait, à quoi il sert, qui est dedans.
export default async function ComitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { t } = await i18n()
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  const espace = await getEspace(acteur)
  if (espace.actif !== CLINIQUE_COMITES) redirect('/dashboard/accueil')
  const admin = peutGererComites(acteur)
  const { comites } = await chargerComites(serviceClient(), { brouillons: admin, id })
  const c = comites[0]
  if (!c) notFound()
  const k = couleurDe(c.couleur)

  const Bloc = ({ icone, titre, texte }: { icone: string; titre: string; texte: string }) => texte ? (
    <section className="bg-white rounded-2xl border border-gray-200 p-5">
      <h2 className="text-sm font-bold text-gray-900 mb-2">{icone} {titre}</h2>
      <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{texte}</div>
    </section>
  ) : null

  return (
    <div className="max-w-4xl">
      <Link href="/dashboard/comites" className="text-sm text-gray-500 hover:text-gray-800">← {t('Tous les comités')}</Link>
      <div className="flex items-center gap-4 mt-3 mb-6">
        <span className="w-14 h-14 rounded-full flex items-center justify-center text-3xl shrink-0" style={{ background: k.fond }}>{c.icone}</span>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{c.nom}</h1>
          {c.presentation && <p className="text-sm text-gray-600 mt-0.5">{c.presentation}</p>}
        </div>
        {!c.publie && <span className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">{t('Brouillon')}</span>}
      </div>

      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <Bloc icone="ℹ️" titre={t('Description')} texte={c.description} />
        <Bloc icone="✅" titre={t('Ce qu’il fait')} texte={c.activites} />
        <Bloc icone="🎯" titre={t('À quoi il sert')} texte={c.utilite} />
      </div>

      {(c.membres.length > 0 || c.contact) && (
        <section className="bg-white rounded-2xl border border-gray-200 p-5">
          {c.membres.length > 0 && <>
            <h2 className="text-sm font-bold text-gray-900 mb-3">👥 {t('Qui est dedans')}</h2>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
              {c.membres.map((m, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ background: k.fond, color: k.texte }}>{initiales(m.nom)}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-gray-900">{m.nom}</span>
                    {m.role && <span className="block text-xs font-medium" style={{ color: k.texte }}>{m.role}</span>}
                    {m.poste && <span className="block text-xs text-gray-500">{m.poste}</span>}
                  </span>
                </div>
              ))}
            </div>
          </>}
          {c.contact && <p className={'text-sm text-gray-700 ' + (c.membres.length ? 'mt-4 pt-4 border-t border-gray-100' : '')}>✉️ {t('Joindre le comité :')} {c.contact}</p>}
        </section>
      )}
    </div>
  )
}
