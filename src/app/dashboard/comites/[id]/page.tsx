import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { i18n } from '@/lib/i18n/serveur'
import { getActeur, serviceClient } from '@/lib/permissions'
import { getEspace } from '@/lib/espace'
import { blocsTexte, chargerComites, couleurDe, initiales, peutGererComites, CLINIQUE_COMITES } from '@/lib/comites'

export const dynamic = 'force-dynamic'

// Page d'un comité : couverture, description, puis ce qu'il fait et à quoi il sert, et ses membres.
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

  // Texte mis en forme : paragraphes et listes à puces colorées
  const Texte = ({ texte }: { texte: string }) => (
    <div className="space-y-3 text-[15px] text-gray-700 leading-relaxed">
      {blocsTexte(texte).map((b, i) => b.type === 'paragraphe'
        ? <p key={i}>{b.texte}</p>
        : <ul key={i} className="space-y-2">{b.items.map((it, j) => (
            <li key={j} className="flex gap-3"><span className="mt-2 w-2 h-2 rounded-full shrink-0" style={{ background: k.bord }} /><span>{it}</span></li>
          ))}</ul>)}
    </div>
  )
  const Section = ({ titre, texte }: { titre: string; texte: string }) => texte ? (
    <section className="bg-white rounded-2xl border border-gray-200 p-6" style={{ borderTop: `4px solid ${k.bord}` }}>
      <h2 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: k.texte }}>{titre}</h2>
      <Texte texte={texte} />
    </section>
  ) : null

  return (
    <div className="max-w-5xl mx-auto">
      <Link href="/dashboard/comites" className="text-sm text-gray-500 hover:text-gray-800">← {t('Tous les comités')}</Link>

      {/* En-tête : couverture et nom */}
      <header className="mt-3 mb-6 rounded-2xl overflow-hidden grid items-stretch" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', background: `linear-gradient(135deg, ${k.texte}, ${k.bord})` }}>
        {c.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.image} alt="" className="w-full h-full object-cover" style={{ maxHeight: 340, aspectRatio: '1 / 1' }} />
        )}
        <div className="p-7 flex flex-col justify-center gap-3 text-white">
          <span className="text-xs font-bold uppercase tracking-wider opacity-80">{t('Comité')}{!c.publie ? ' · ' + t('Brouillon') : ''}</span>
          <h1 className="text-2xl md:text-3xl font-bold leading-tight">{c.nom}</h1>
          {c.presentation && <p className="text-[15px] leading-relaxed opacity-90">{c.presentation}</p>}
          <span className="text-sm opacity-80">{t('{n} membre(s)', { n: c.membres.length })}</span>
        </div>
      </header>

      <div className="space-y-5">
        <Section titre={t('Description')} texte={c.description} />
        {(c.activites || c.utilite) && (
          <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
            <Section titre={t('Ce qu’il fait')} texte={c.activites} />
            <Section titre={t('À quoi il sert')} texte={c.utilite} />
          </div>
        )}

        {(c.membres.length > 0 || c.contact) && (
          <section className="bg-white rounded-2xl border border-gray-200 p-6" style={{ borderTop: `4px solid ${k.bord}` }}>
            {c.membres.length > 0 && <>
              <h2 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: k.texte }}>{t('Qui est dedans')}</h2>
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
                {c.membres.map((m, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl p-3" style={{ background: k.fond }}>
                    <span className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0 text-white" style={{ background: k.bord }}>{initiales(m.nom)}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-gray-900">{m.nom}</span>
                      {m.role && <span className="block text-xs font-semibold" style={{ color: k.texte }}>{m.role}</span>}
                      {m.poste && <span className="block text-xs text-gray-600">{m.poste}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </>}
            {c.contact && <p className={'text-sm text-gray-700 ' + (c.membres.length ? 'mt-5 pt-4 border-t border-gray-100' : '')}><span className="font-semibold">{t('Joindre le comité :')}</span> {c.contact}</p>}
          </section>
        )}
      </div>
    </div>
  )
}
