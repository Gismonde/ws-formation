// Portail employé : Événements (formations en présentiel, 5 à 7 et activités, événements de la clinique).
// Bannière « en vedette » (choisie par l'admin, sinon le prochain événement), filtres par type,
// les deux prochaines semaines, cartes ; vues Cartes / Calendrier / Mes inscriptions.
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActeur, serviceClient } from '@/lib/permissions'
import { evenementsDeLEmploye, seanceOuverte, placesIllimitees, typeEvenement, fondEvenement, emojiEvenement, TYPES_EVENEMENT, type InfoType } from '@/lib/evenements'
import { i18n } from '@/lib/i18n/serveur'
import CompteARebours from './CompteARebours'

export const dynamic = 'force-dynamic'

type Liste = Awaited<ReturnType<typeof evenementsDeLEmploye>>
type X = Liste[number]


export default async function MesEvenementsPage({ searchParams }: { searchParams: Promise<{ type?: string; vue?: string; mois?: string }> }) {
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  const { t, loc } = await i18n()
  const sp = await searchParams
  const sb = serviceClient()
  const liste = await evenementsDeLEmploye(sb, acteur)
  const vue = sp.vue === 'calendrier' || sp.vue === 'miennes' ? sp.vue : 'cartes'

  const aVenirTous = liste.filter(x => !x.termine).sort((a, b) => (a.prochaine ?? '9').localeCompare(b.prochaine ?? '9'))
  const passes = liste.filter(x => x.termine)
  // Types affichés : les trois de base + ceux créés par les admins qui ont des événements
  const typesPresents: InfoType[] = [...TYPES_EVENEMENT]
  for (const x of liste) { const ty = typeEvenement(x.ev); if (!typesPresents.some(y => y.id === ty.id)) typesPresents.push(ty) }
  const filtre = (x: X) => !sp.type ? true : sp.type === 'a_venir' ? !!x.ev.date_a_venir && !x.seances.some(s => seanceOuverte(s)) : typeEvenement(x.ev).id === sp.type
  const aVenir = aVenirTous.filter(filtre).filter(x => vue !== 'miennes' || !!x.mienne)

  // Participants (initiales) pour les événements sociaux et de la clinique
  const ids = liste.filter(x => typeEvenement(x.ev).mode === 'participation').map(x => x.ev.id)
  const { data: ins } = ids.length ? await sb.from('evenements_inscriptions').select('evenement_id, employe_id').in('evenement_id', ids).eq('statut', 'inscrit') : { data: [] }
  const empIds = Array.from(new Set((ins ?? []).map(i => i.employe_id as string)))
  const { data: emps } = empIds.length ? await sb.from('employes').select('id, prenom, nom').in('id', empIds.slice(0, 500)) : { data: [] }
  const initiales = new Map((emps ?? []).map(e => [e.id as string, `${(e.prenom ?? ' ')[0]}${(e.nom ?? ' ')[0]}`.toUpperCase()]))
  const participants = (id: string) => (ins ?? []).filter(i => i.evenement_id === id).map(i => initiales.get(i.employe_id as string) ?? '·')

  // Bannière : l'événement mis en vedette par l'admin, sinon le prochain
  const vedette = aVenirTous.find(x => x.ev.en_vedette) ?? aVenirTous.find(x => x.prochaine) ?? aVenirTous[0] ?? null

  const jourCourt = (d: string) => new Date(d).toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' })
  const heure = (d: string) => new Date(d).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })
  const prochaineSeance = (x: X) => x.seances.filter(s => !s.annulee).sort((a, b) => a.debut.localeCompare(b.debut)).find(s => seanceOuverte(s)) ?? null
  const lien = (p: Record<string, string | undefined>) => '/dashboard/evenements?' + new URLSearchParams(Object.entries({ ...sp, ...p }).filter(([, v]) => v) as [string, string][]).toString()

  const Avatars = ({ x, clair }: { x: X; clair?: boolean }) => {
    const p = participants(x.ev.id)
    if (!p.length) return null
    const couleurs = ['#fde68a', '#bfdbfe', '#c7d2fe', '#fbcfe8']
    return (
      <span className={'flex items-center text-sm font-semibold ' + (clair ? 'text-white' : 'text-gray-600')}>
        <span className="flex">
          {p.slice(0, 3).map((ini, i) => <i key={i} className="-ml-2 first:ml-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold not-italic text-gray-800" style={{ background: couleurs[i] }}>{ini}</i>)}
          {p.length > 3 && <i className="-ml-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold not-italic text-gray-800" style={{ background: couleurs[3] }}>+{p.length - 3}</i>}
        </span>
        <span className="ml-2">{t('{n} collègue(s) y vont', { n: p.length })}</span>
      </span>
    )
  }

  const BoutonEtat = ({ x }: { x: X }) => {
    const ty = typeEvenement(x.ev)
    const ouvertes = x.seances.filter(s => seanceOuverte(s))
    if (x.mienne?.statut === 'inscrit') return <span className="rounded-xl bg-green-100 px-3.5 py-2 text-sm font-extrabold text-green-800">✓ {t('J’y serai')}</span>
    if (x.mienne?.statut === 'attente') return <span className="rounded-xl bg-indigo-100 px-3.5 py-2 text-sm font-extrabold text-indigo-800">{t('Liste d’attente')}</span>
    if (!ouvertes.length && x.ev.date_a_venir) return <span className="rounded-xl bg-indigo-50 px-3.5 py-2 text-sm font-extrabold text-indigo-700">🔔 {t('Me prévenir')}</span>
    if (!ouvertes.length) return <span className="rounded-xl bg-gray-100 px-3.5 py-2 text-sm font-bold text-gray-600">{t('Inscriptions fermées')}</span>
    if (!ouvertes.some(s => s.restantes > 0)) return <span className="rounded-xl bg-gray-100 px-3.5 py-2 text-sm font-extrabold text-gray-700">{t('Liste d’attente')}</span>
    return <span className="rounded-xl px-3.5 py-2 text-sm font-extrabold text-white" style={{ background: ty.couleur }}>{ty.mode === 'inscription' ? t('S’inscrire') : `🎟️ ${t('Je participe')}`}</span>
  }

  const Carte = ({ x }: { x: X }) => {
    const ty = typeEvenement(x.ev)
    const s = prochaineSeance(x) ?? x.seances.find(y => !y.annulee) ?? null
    const aVenirSansDate = !s && x.ev.date_a_venir
    const d = s ? new Date(s.debut) : null
    const illimite = s ? placesIllimitees(s) : false
    const pris = s && !illimite ? s.places - s.restantes : 0
    return (
      <Link href={`/dashboard/evenements/${x.ev.id}`}
        className={'group flex flex-col overflow-hidden rounded-[20px] bg-white transition hover:-translate-y-0.5 hover:shadow-lg ' + (aVenirSansDate ? 'border-2 border-dashed border-indigo-200' : 'border border-gray-100 shadow-[0_6px_22px_rgba(17,24,39,.06)]')}>
        <div className="relative flex h-40 items-center justify-center text-6xl" style={{ background: aVenirSansDate && !x.ev.fond ? 'repeating-linear-gradient(45deg,#eef2ff,#eef2ff 12px,#e0e7ff 12px,#e0e7ff 24px)' : fondEvenement(x.ev).hero }}>
          <span aria-hidden className="drop-shadow-lg">{emojiEvenement(x.ev)}</span>
          <div className="absolute left-3.5 top-3.5 rounded-2xl bg-white px-3 py-1.5 text-center shadow-md">
            {d ? (<>
              <small className="block text-[11px] font-extrabold uppercase tracking-wider text-red-600">{d.toLocaleDateString(loc, { month: 'short' }).replace('.', '')}</small>
              <b className="block text-2xl font-extrabold leading-tight">{d.getDate()}</b>
            </>) : (<>
              <small className="block text-[11px] font-extrabold uppercase tracking-wider text-indigo-600">{t('Bientôt')}</small>
              <b className="block text-sm font-extrabold">{t('Date à venir')}</b>
            </>)}
          </div>
          <span className="absolute right-3.5 top-3.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-extrabold" style={{ color: ty.couleur }}>{ty.emoji} {t(ty.court)}</span>
          {x.ev.compte_a_rebours && s && (() => {
            const ms = Date.parse(s.debut) - Date.now(), j = Math.floor(ms / 86_400_000), h = Math.floor((ms % 86_400_000) / 3_600_000)
            return ms > 0 ? <span className="absolute bottom-3 right-3.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-extrabold text-white backdrop-blur">⏳ {j > 0 ? t('Dans {j} j {h} h', { j, h }) : t('Dans {h} h', { h: Math.max(0, h) })}</span> : null
          })()}
        </div>
        <div className="flex flex-1 flex-col p-4">
          <h3 className="text-[17px] font-extrabold leading-snug text-gray-900">{x.ev.titre}</h3>
          <div className="mt-2 grid gap-0.5 text-[13px] text-gray-500">
            {s ? <span>🕘 {jourCourt(s.debut)} · {heure(s.debut)} – {heure(s.fin)}</span> : <span>{t('La date sera annoncée bientôt')}</span>}
            {(s?.lieu || x.ev.lieu) && <span>📍 {s?.lieu || x.ev.lieu}</span>}
            {aVenirSansDate && x.ev.places_prevues ? <span>🎟️ {x.ev.places_prevues >= 1000 ? t('Places illimitées') : t('{n} place(s) prévue(s)', { n: x.ev.places_prevues })}</span> : null}
            {(x.ev.obligatoire || x.ev.duree_minutes) && <span>{x.ev.obligatoire ? `⚠️ ${t('Obligatoire')}` : ''}{x.ev.obligatoire && x.ev.duree_minutes ? ' · ' : ''}{x.ev.duree_minutes ? `⏱ ${t('{n} min de formation', { n: x.ev.duree_minutes })}` : ''}</span>}
          </div>
          <div className="mt-auto flex items-end justify-between gap-3 pt-4">
            <div className="min-w-0">
              {ty.mode === 'participation' ? <Avatars x={x} />
                : s && !illimite ? (<>
                  <div className={'text-xs font-bold ' + (s.restantes === 0 ? 'text-red-600' : s.restantes <= 3 ? 'text-amber-700' : 'text-green-700')}>{s.restantes === 0 ? t('Complet') : t('{n} place(s) restante(s)', { n: s.restantes })}</div>
                  <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-slate-100"><i className="block h-full" style={{ width: `${Math.round((pris / Math.max(1, s.places)) * 100)}%`, background: s.restantes === 0 ? '#ef4444' : s.restantes <= 3 ? '#f59e0b' : '#22c55e' }} /></div>
                </>) : null}
            </div>
            <BoutonEtat x={x} />
          </div>
        </div>
      </Link>
    )
  }

  // Les deux prochaines semaines (jours ouvrables)
  const jours: Date[] = []
  for (let d = new Date(); jours.length < 10; d = new Date(d.getTime() + 86_400_000)) if (d.getDay() !== 0 && d.getDay() !== 6) jours.push(new Date(d.getFullYear(), d.getMonth(), d.getDate()))
  const memeJour = (a: Date, iso: string) => { const b = new Date(iso); return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate() }
  const parJour = (j: Date) => aVenirTous.flatMap(x => x.seances.filter(s => !s.annulee && memeJour(j, s.debut)).map(() => typeEvenement(x.ev)))

  // Vue calendrier : mois affiché
  const base = sp.mois && /^\d{4}-\d{2}$/.test(sp.mois) ? new Date(Number(sp.mois.slice(0, 4)), Number(sp.mois.slice(5)) - 1, 1) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const moisStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  const debutGrille = new Date(base); debutGrille.setDate(1 - ((base.getDay() + 6) % 7))
  const cases = Array.from({ length: 42 }, (_, i) => new Date(debutGrille.getFullYear(), debutGrille.getMonth(), debutGrille.getDate() + i))
  const seancesDuJour = (j: Date) => liste.filter(filtre).flatMap(x => x.seances.filter(s => !s.annulee && memeJour(j, s.debut)).map(s => ({ x, s })))

  const tyV = vedette ? typeEvenement(vedette.ev) : null
  const sV = vedette ? prochaineSeance(vedette) : null

  return (
    <div className="mx-auto max-w-6xl px-1 py-2">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">🎉 {t('Événements')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('Formations en présentiel, 5 à 7, activités et grands moments de la clinique.')}</p>
        </div>
        <nav className="flex rounded-xl border border-gray-200 bg-white p-1 text-[13px] font-semibold">
          {([['cartes', `▦ ${t('Cartes')}`], ['calendrier', `📅 ${t('Calendrier')}`], ['miennes', `✓ ${t('Mes inscriptions')}`]] as const).map(([k, l]) => (
            <Link key={k} href={lien({ vue: k === 'cartes' ? undefined : k })} className={'rounded-lg px-3.5 py-2 ' + (vue === k ? 'text-white' : 'text-gray-500 hover:text-gray-800')} style={vue === k ? { background: 'var(--accent-clinique, #1e3a6e)' } : undefined}>{l}</Link>
          ))}
        </nav>
      </div>

      {/* Bannière */}
      {vedette && tyV ? (
        <Link href={`/dashboard/evenements/${vedette.ev.id}`} className="relative mt-5 flex min-h-[300px] flex-col justify-center overflow-hidden rounded-3xl p-8 text-white shadow-lg md:flex-row md:items-center md:justify-between md:p-10" style={{ background: fondEvenement(vedette.ev).hero }}>
          <div className="relative max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs font-bold backdrop-blur">{vedette.ev.en_vedette ? '⭐ ' : ''}{emojiEvenement(vedette.ev)} {t(tyV.libelle)}</span>
            <h2 className="mt-3.5 text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">{vedette.ev.titre}</h2>
            <div className="mt-3.5 flex flex-wrap gap-x-5 gap-y-1 text-[15px] font-semibold opacity-95">
              {sV ? <span>📅 {jourCourt(sV.debut)} · {heure(sV.debut)} – {heure(sV.fin)}</span> : <span>📅 {t('Date à venir')}</span>}
              {(sV?.lieu || vedette.ev.lieu) && <span>📍 {sV?.lieu || vedette.ev.lieu}</span>}
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <span className="rounded-xl bg-white px-5 py-3 text-[15px] font-extrabold shadow-lg" style={{ color: tyV.couleur }}>
                {vedette.mienne?.statut === 'inscrit' ? `✓ ${t('Vous y serez !')}` : vedette.mienne?.statut === 'attente' ? t('Liste d’attente') : !sV && vedette.ev.date_a_venir ? `🔔 ${t('Me prévenir')}` : tyV.mode === 'inscription' ? t('S’inscrire') : `🎟️ ${t('Je participe')}`}
              </span>
              {tyV.mode === 'participation' && <Avatars x={vedette} clair />}
            </div>
          </div>
          {sV && vedette.ev.compte_a_rebours && (
            <div className="relative mt-6 w-full max-w-xs rounded-2xl border border-white/35 bg-white/15 p-5 text-center backdrop-blur md:mt-0">
              <div className="text-xs font-bold uppercase tracking-[2px] opacity-85">{t('C’est dans')}</div>
              <div className="mt-3"><CompteARebours date={sV.debut} couleur={tyV.couleur} /></div>
            </div>
          )}
        </Link>
      ) : (
        <div className="mt-5 flex min-h-[200px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-gray-200 bg-white p-8 text-center">
          <span className="text-5xl" aria-hidden>🗓️</span>
          <p className="mt-3 text-xl font-extrabold uppercase tracking-wide text-gray-400">{t('Aucun événement à venir')}</p>
          <p className="mt-1 text-sm text-gray-400">{t('Les prochains événements de la clinique apparaîtront ici.')}</p>
        </div>
      )}

      {/* Filtres */}
      <div className="mt-6 flex flex-wrap gap-2.5">
        {[{ id: undefined, l: t('Tous'), n: aVenirTous.length }, ...typesPresents.map(ty => ({ id: ty.id as string, l: `${ty.emoji} ${t(ty.libelle)}`, n: aVenirTous.filter(x => typeEvenement(x.ev).id === ty.id).length })),
          { id: 'a_venir', l: `📅 ${t('Dates à venir')}`, n: aVenirTous.filter(x => x.ev.date_a_venir && !x.seances.some(s => seanceOuverte(s))).length }]
          .filter(c => c.id === undefined || c.n > 0 || sp.type === c.id).map(c => (
            <Link key={c.id ?? 'tous'} href={lien({ type: c.id })} className={'flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-bold ' + (sp.type === c.id ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300')}>
              {c.l} <span className={'rounded-full px-1.5 text-[11px] ' + (sp.type === c.id ? 'bg-white/20' : 'bg-gray-100 text-gray-500')}>{c.n}</span>
            </Link>
          ))}
      </div>

      {vue === 'calendrier' ? (
        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <Link href={lien({ mois: moisStr(new Date(base.getFullYear(), base.getMonth() - 1, 1)) })} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-100">←</Link>
            <h2 className="text-lg font-extrabold capitalize text-gray-900">{base.toLocaleDateString(loc, { month: 'long', year: 'numeric' })}</h2>
            <Link href={lien({ mois: moisStr(new Date(base.getFullYear(), base.getMonth() + 1, 1)) })} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-100">→</Link>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase text-gray-400">
            {Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(loc, { weekday: 'short' })).map(j => <div key={j} className="py-1">{j}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cases.map((j, i) => {
              const ev = seancesDuJour(j)
              const autreMois = j.getMonth() !== base.getMonth()
              const auj = memeJour(j, new Date().toISOString())
              return (
                <div key={i} className={'min-h-[86px] rounded-lg border p-1.5 text-left ' + (autreMois ? 'border-transparent bg-gray-50 text-gray-300' : auj ? 'border-2' : 'border-gray-100')} style={auj ? { borderColor: 'var(--accent-clinique, #1e3a6e)' } : undefined}>
                  <div className="text-xs font-bold">{j.getDate()}</div>
                  {ev.slice(0, 3).map(({ x, s }) => (
                    <Link key={s.id} href={`/dashboard/evenements/${x.ev.id}`} className="mt-0.5 block truncate rounded px-1 py-0.5 text-[11px] font-semibold text-white" style={{ background: typeEvenement(x.ev).couleur }} title={x.ev.titre}>
                      {heure(s.debut)} {x.ev.titre}
                    </Link>
                  ))}
                  {ev.length > 3 && <div className="text-[10px] text-gray-500">+{ev.length - 3}</div>}
                </div>
              )
            })}
          </div>
        </section>
      ) : (
        <>
          {vue === 'cartes' && (
            <>
              <h2 className="mb-3 mt-7 flex items-center gap-2 text-lg font-extrabold text-gray-900">📆 {t('Les 2 prochaines semaines')}</h2>
              <div className="flex gap-2.5 overflow-x-auto pb-1">
                {jours.map((j, i) => {
                  const pts = parJour(j)
                  return (
                    <div key={i} className={'w-[92px] flex-shrink-0 rounded-2xl bg-white p-2.5 text-center ' + (i === 0 ? 'border-2' : 'border border-gray-200')} style={i === 0 ? { borderColor: 'var(--accent-clinique, #1e3a6e)' } : undefined}>
                      <small className="text-[11px] font-bold uppercase text-gray-500">{j.toLocaleDateString(loc, { weekday: 'short' }).replace('.', '')}</small>
                      <b className="block text-2xl font-extrabold">{j.getDate()}</b>
                      <div className="mt-1 flex h-2 justify-center gap-1">{pts.slice(0, 4).map((ty, k) => <i key={k} className="h-2 w-2 rounded-full" style={{ background: ty.couleur }} title={t(ty.libelle)} />)}</div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">
                {typesPresents.map(ty => <span key={ty.id}><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full" style={{ background: ty.couleur }} />{t(ty.court)}</span>)}
              </div>
            </>
          )}

          <h2 className="mb-3 mt-7 flex items-center gap-2 text-lg font-extrabold text-gray-900">{vue === 'miennes' ? `✓ ${t('Mes inscriptions')}` : `✨ ${t('À venir')}`}</h2>
          {aVenir.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">{vue === 'miennes' ? t('Vous n’êtes inscrit(e) à aucun événement à venir.') : t('Aucun événement pour le moment.')}</div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{aVenir.map(x => <Carte key={x.ev.id} x={x} />)}</div>
          )}

          {passes.filter(filtre).filter(x => vue !== 'miennes' || !!x.mienne).length > 0 && (
            <>
              <h2 className="mb-3 mt-9 text-base font-bold text-gray-600">{t('Événements passés')}</h2>
              <div className="grid gap-5 opacity-75 sm:grid-cols-2 lg:grid-cols-3">{passes.filter(filtre).filter(x => vue !== 'miennes' || !!x.mienne).map(x => <Carte key={x.ev.id} x={x} />)}</div>
            </>
          )}
        </>
      )}
    </div>
  )
}
