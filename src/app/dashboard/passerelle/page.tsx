import { redirect } from 'next/navigation'
import { i18n } from '@/lib/i18n/serveur'
import { getActeur, serviceClient } from '@/lib/permissions'
import { getEspace } from '@/lib/espace'
import { signerUrlsMedias } from '@/lib/medias-serveur'
import { chargerAppel, chargerEditions, couleurEdition, peutGererPasserelle, CLINIQUE_PASSERELLE, type Edition } from '@/lib/passerelle'

export const dynamic = 'force-dynamic'

// « La Passerelle » : le kiosque du journal de la clinique (espace WSSC).
export default async function PasserellePage() {
  const { t, loc } = await i18n()
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  const espace = await getEspace(acteur)
  if (espace.actif !== CLINIQUE_PASSERELLE) redirect('/dashboard/accueil')
  const sb = serviceClient()
  const admin = peutGererPasserelle(acteur)
  const [{ editions }, appel, { data: lues }] = await Promise.all([
    chargerEditions(sb, admin), chargerAppel(sb),
    sb.from('passerelle_lectures').select('edition_id').eq('employe_id', acteur.id),
  ])
  const dejaLues = new Set((lues ?? []).map(l => l.edition_id as string))
  const urls = await signerUrlsMedias(editions.map(e => e.couverture))
  const [une, ...anciennes] = editions
  const date = (d: string, style: 'long' | 'mois') => new Date(d + 'T12:00:00').toLocaleDateString(loc, style === 'long' ? { dateStyle: 'long' } : { month: 'long', year: 'numeric' })
  const nouvelle = (e: Edition) => (Date.now() - new Date(e.date_parution + 'T12:00:00').getTime()) < 30 * 86400_000
  const lire = (e: Edition) => `/api/passerelle/${e.id}/lire`

  return (
    <div className="max-w-5xl mx-auto">
      <header className="text-center mb-8">
        <div className="flex items-center justify-center gap-4">
          <span className="h-px w-16 bg-[#0C447C]/40" />
          <h1 className="text-3xl md:text-4xl font-light tracking-[0.35em] text-[#0C447C]">LA PASSERELLE</h1>
          <span className="h-px w-16 bg-[#0C447C]/40" />
        </div>
        <p className="text-xs tracking-[0.4em] text-gray-500 mt-2">{t('LE PONT ENTRE NOUS')}</p>
        <p className="text-sm text-gray-500 mt-3">{t('Le journal de la clinique : toutes les éditions, à lire ou à télécharger.')}</p>
      </header>

      {!une ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center text-sm text-gray-400">{t('Aucune édition pour l’instant.')}</div>
      ) : (() => {
        const k = couleurEdition(une.couleur)
        return (
          <section className="relative rounded-3xl overflow-hidden mb-10" style={{ background: `linear-gradient(135deg, ${k.fond} 0%, #ffffff 70%)`, border: `1px solid ${k.accent}40` }}>
            <div className="grid gap-8 p-6 md:p-8 items-center" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
              <a href={lire(une)} target="_blank" rel="noopener" className="block mx-auto w-full max-w-[300px] transition-transform duration-300 hover:-translate-y-2 hover:rotate-0" style={{ transform: 'rotate(-2deg)' }}>
                {urls[une.couverture]
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={urls[une.couverture]} alt={t('Couverture de l’édition {n}', { n: une.numero })} className="w-full rounded-lg bg-white" style={{ boxShadow: '0 18px 40px rgba(15,23,42,0.25)' }} />
                  : <span className="block w-full aspect-[3/4] rounded-lg" style={{ background: k.accent }} />}
              </a>
              <div>
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full text-white" style={{ background: k.accent }}>{nouvelle(une) ? t('Nouveau') : t('À la une')}</span>
                  {!une.publie && <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-200 text-gray-700">{t('Brouillon')}</span>}
                  {dejaLues.has(une.id) && <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-600">✓ {t('Lue')}</span>}
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900">{t('Édition {n}', { n: une.numero })}</h2>
                <p className="text-sm text-gray-600 mt-1">{date(une.date_parution, 'long')} · {t('Volume {n}', { n: une.volume })}</p>
                {une.temps_lecture && <p className="text-sm mt-1" style={{ color: k.texte }}>{t('Environ {n} minutes de lecture', { n: une.temps_lecture })}</p>}
                {une.accroche && <p className="text-[15px] text-gray-700 mt-4 leading-relaxed">{une.accroche}</p>}
                {une.sommaire.length > 0 && (
                  <div className="mt-5">
                    <p className="text-xs font-bold tracking-wider mb-2" style={{ color: k.texte }}>{t('CE QUI VOUS ATTEND DANS CETTE ÉDITION')}</p>
                    <ul className="space-y-1.5">
                      {une.sommaire.map((s, i) => (
                        <li key={i} className="flex items-baseline gap-3 text-sm text-gray-800 border-b border-dashed pb-1.5" style={{ borderColor: `${k.accent}55` }}>
                          <span className="flex-1">{s.titre}</span>
                          {s.page && <span className="font-semibold" style={{ color: k.texte }}>p. {s.page}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex flex-wrap gap-3 mt-6">
                  <a href={lire(une)} target="_blank" rel="noopener" className="text-sm font-semibold px-5 py-2.5 rounded-xl text-white shadow-sm hover:opacity-90" style={{ background: k.accent }}>{t('Lire l’édition')} ↗</a>
                  <a href={lire(une) + '?telecharger=1'} className="text-sm font-semibold px-5 py-2.5 rounded-xl bg-white border border-gray-300 text-gray-800 hover:bg-gray-50">{t('Télécharger le PDF')}</a>
                </div>
              </div>
            </div>
          </section>
        )
      })()}

      {anciennes.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-bold text-gray-900 mb-4">{t('Éditions précédentes')}</h2>
          {/* L'étagère : chaque édition repose sur son morceau d'étagère, les morceaux se rejoignent sur une même rangée */}
          <div className="flex flex-wrap gap-y-8">
            {anciennes.map(e => {
              const k = couleurEdition(e.couleur)
              return (
                <div key={e.id} className="w-1/2 sm:w-1/3 md:w-1/4 lg:w-1/5 flex flex-col">
                  <a href={lire(e)} target="_blank" rel="noopener" className="group block px-4 pt-3">
                    <span className="block transition-transform duration-300 group-hover:-translate-y-3 group-hover:-rotate-2">
                      {urls[e.couverture]
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={urls[e.couverture]} alt={t('Couverture de l’édition {n}', { n: e.numero })} className="w-full rounded-md bg-white" style={{ boxShadow: '0 10px 22px rgba(15,23,42,0.22)', borderTop: `4px solid ${k.accent}` }} />
                        : <span className="block w-full aspect-[3/4] rounded-md" style={{ background: k.accent }} />}
                    </span>
                  </a>
                  <span className="block h-3.5 mt-auto" style={{ background: 'linear-gradient(180deg, #c9a27a, #9c7650)', boxShadow: '0 6px 8px rgba(80,50,20,0.22)' }} />
                  <div className="text-center px-2 mt-3">
                    <p className="text-sm font-semibold text-gray-900">{t('Édition {n}', { n: e.numero })}{!e.publie ? ' · ' + t('Brouillon') : ''}</p>
                    <p className="text-xs text-gray-500 capitalize">{date(e.date_parution, 'mois')}</p>
                    <div className="flex justify-center gap-3 mt-1 text-xs">
                      {dejaLues.has(e.id) && <span className="text-green-700">✓ {t('Lue')}</span>}
                      <a href={lire(e) + '?telecharger=1'} className="text-gray-500 hover:text-gray-900 underline">{t('PDF')}</a>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {appel.texte && (
        <section className="rounded-3xl p-6 md:p-8 mb-6 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #FBEAF0 0%, #FAEEDA 50%, #E1F5EE 100%)' }}>
          <h2 className="text-2xl font-bold text-[#72243E]">{appel.titre}</h2>
          <p className="text-[15px] text-gray-800 mt-3 leading-relaxed whitespace-pre-line max-w-3xl">{appel.texte}</p>
        </section>
      )}
    </div>
  )
}
