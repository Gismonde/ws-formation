'use client'
// Rendu des blocs interactifs côté employé (et dans l'aperçu de l'éditeur).
import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '@/lib/i18n/client'
import { dansZone, scoreErreurs, type DonneesInteractif, type Zone } from '@/lib/blocs-interactifs'

type Urls = Record<string, string>
const adresse = (v: string | null | undefined, urls: Urls) => (!v ? null : v.startsWith('media:') ? urls[v] ?? null : v)
const carte = 'bg-white rounded-xl border border-gray-200 overflow-hidden'
const accent = 'var(--accent-clinique, #4f46e5)'

export default function BlocInteractif({ titre, d, urls, onReussi }: { titre: string | null; d: DonneesInteractif; urls: Urls; onReussi?: () => void }) {
  const corps = (() => {
    switch (d.genre) {
      case 'cartes': return <Cartes d={d} />
      case 'accordeon': return <Accordeon d={d} />
      case 'etapes': return <Etapes d={d} urls={urls} />
      case 'chronologie': return <Chronologie d={d} />
      case 'avant_apres': return <AvantApres d={d} urls={urls} />
      case 'animation': return <Animation d={d} />
      case 'zones': return <Zones d={d} urls={urls} />
      case 'erreurs': return <Erreurs d={d} urls={urls} onReussi={onReussi} />
      case 'scenario': return <Scenario d={d} urls={urls} onReussi={onReussi} />
      case 'glisser': return <Glisser d={d} onReussi={onReussi} />
      default: return null
    }
  })()
  return (
    <div className={carte}>
      {titre && <div className="px-6 py-4 border-b border-gray-100"><h3 className="text-lg font-semibold text-gray-900">{titre}</h3></div>}
      {d.consigne && ['zones', 'erreurs', 'glisser'].includes(d.genre) && <p className="px-6 pt-4 text-sm text-gray-600">{d.consigne}</p>}
      <div className="p-4 sm:p-6">{corps}</div>
    </div>
  )
}

// --- Cartes à retourner ---------------------------------------------------
function Cartes({ d }: { d: DonneesInteractif }) {
  const { t } = useT()
  const [retournees, setRetournees] = useState<number[]>([])
  const cartes = (d.cartes ?? []).filter(c => c.recto.trim())
  return (
    <div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {cartes.map((c, i) => {
          const r = retournees.includes(i)
          return (
            <button key={i} type="button" onClick={() => setRetournees(x => (r ? x.filter(y => y !== i) : [...x, i]))}
              className="h-40 [perspective:1000px] text-left" aria-pressed={r}>
              <div className="relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d]" style={{ transform: r ? 'rotateY(180deg)' : 'none' }}>
                <div className="absolute inset-0 rounded-xl border-2 p-4 flex items-center justify-center text-center font-semibold text-gray-900 bg-white [backface-visibility:hidden]" style={{ borderColor: accent }}>{c.recto}</div>
                <div className="absolute inset-0 rounded-xl p-4 flex items-center justify-center text-center text-sm text-white [backface-visibility:hidden] [transform:rotateY(180deg)] overflow-auto" style={{ background: accent }}>{c.verso}</div>
              </div>
            </button>
          )
        })}
      </div>
      <p className="text-xs text-gray-400 mt-3">{t('Cliquez sur une carte pour la retourner.')} {retournees.length}/{cartes.length}</p>
    </div>
  )
}

// --- Accordéon / onglets --------------------------------------------------
function Accordeon({ d }: { d: DonneesInteractif }) {
  const sections = (d.sections ?? []).filter(s => s.titre.trim())
  const [ouvert, setOuvert] = useState<number | null>(d.mode === 'onglets' ? 0 : null)
  if (d.mode === 'onglets') {
    return (
      <div>
        <div className="flex flex-wrap gap-1 border-b border-gray-200 mb-4">
          {sections.map((s, i) => (
            <button key={i} type="button" onClick={() => setOuvert(i)} className={'px-4 py-2 text-sm font-medium -mb-px border-b-2 ' + (ouvert === i ? 'text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800')} style={ouvert === i ? { borderColor: accent } : undefined}>{s.titre}</button>
          ))}
        </div>
        {ouvert !== null && sections[ouvert] && <p className="text-gray-700 whitespace-pre-line leading-relaxed">{sections[ouvert].texte}</p>}
      </div>
    )
  }
  return (
    <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
      {sections.map((s, i) => (
        <div key={i}>
          <button type="button" onClick={() => setOuvert(ouvert === i ? null : i)} className="w-full flex items-center justify-between px-4 py-3 text-left font-medium text-gray-900 hover:bg-gray-50" aria-expanded={ouvert === i}>
            {s.titre}<span className={'transition-transform ' + (ouvert === i ? 'rotate-180' : '')}>⌄</span>
          </button>
          {ouvert === i && <p className="px-4 pb-4 text-gray-700 whitespace-pre-line leading-relaxed animate-[fadeIn_.2s_ease]">{s.texte}</p>}
        </div>
      ))}
    </div>
  )
}

// --- Étapes guidées -------------------------------------------------------
function Etapes({ d, urls }: { d: DonneesInteractif; urls: Urls }) {
  const { t } = useT()
  const etapes = (d.etapes ?? []).filter(e => e.titre.trim() || e.texte.trim())
  const [i, setI] = useState(0)
  const e = etapes[i]
  if (!e) return null
  const img = adresse(e.image ?? null, urls)
  return (
    <div>
      <div className="flex gap-1 mb-4">{etapes.map((_, k) => <span key={k} className="h-1.5 flex-1 rounded-full" style={{ background: k <= i ? accent : '#e5e7eb' }} />)}</div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('Étape {n} sur {total}', { n: i + 1, total: etapes.length })}</p>
      <h4 className="text-lg font-semibold text-gray-900 mt-1">{e.titre}</h4>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {img && <img src={img} alt="" className="mt-3 max-h-64 rounded-lg object-contain" />}
      <p className="text-gray-700 whitespace-pre-line mt-2 leading-relaxed">{e.texte}</p>
      <div className="flex justify-between mt-5">
        <button type="button" disabled={i === 0} onClick={() => setI(i - 1)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm disabled:opacity-40">← {t('Précédente')}</button>
        {i < etapes.length - 1
          ? <button type="button" onClick={() => setI(i + 1)} className="px-4 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: accent }}>{t('Étape suivante')} →</button>
          : <span className="text-sm font-semibold text-green-700">✓ {t('Toutes les étapes vues')}</span>}
      </div>
    </div>
  )
}

// --- Ligne du temps -------------------------------------------------------
function Chronologie({ d }: { d: DonneesInteractif }) {
  const jalons = (d.jalons ?? []).filter(j => j.titre.trim())
  return (
    <ol className="relative border-l-2 ml-3 space-y-6" style={{ borderColor: accent }}>
      {jalons.map((j, i) => (
        <li key={i} className="ml-5">
          <span className="absolute -left-[9px] w-4 h-4 rounded-full border-2 border-white" style={{ background: accent }} />
          {j.date && <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: accent }}>{j.date}</p>}
          <p className="font-semibold text-gray-900">{j.titre}</p>
          {j.texte && <p className="text-sm text-gray-600 whitespace-pre-line mt-0.5">{j.texte}</p>}
        </li>
      ))}
    </ol>
  )
}

// --- Avant / après --------------------------------------------------------
function AvantApres({ d, urls }: { d: DonneesInteractif; urls: Urls }) {
  const { t } = useT()
  const [pos, setPos] = useState(50)
  const avant = adresse(d.avant, urls), apres = adresse(d.apres, urls)
  if (!avant || !apres) return null
  return (
    <div>
      <div className="relative w-full overflow-hidden rounded-lg select-none bg-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={apres} alt={d.legende_apres ?? t('Après')} className="block w-full" />
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avant} alt={d.legende_avant ?? t('Avant')} className="block h-full object-cover object-left" style={{ width: `${10000 / Math.max(pos, 1)}%`, maxWidth: 'none' }} />
        </div>
        <div className="absolute inset-y-0" style={{ left: `${pos}%` }}><div className="h-full w-0.5 bg-white shadow" /><span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white shadow flex items-center justify-center text-xs">↔</span></div>
        <span className="absolute top-2 left-2 text-xs font-semibold bg-black/60 text-white px-2 py-0.5 rounded">{d.legende_avant || t('Avant')}</span>
        <span className="absolute top-2 right-2 text-xs font-semibold bg-black/60 text-white px-2 py-0.5 rounded">{d.legende_apres || t('Après')}</span>
      </div>
      <input type="range" min={0} max={100} value={pos} onChange={e => setPos(Number(e.target.value))} className="w-full mt-3" aria-label={t('Comparer avant et après')} />
    </div>
  )
}

// --- Animation Lottie -----------------------------------------------------
function Animation({ d }: { d: DonneesInteractif }) {
  const { t } = useT()
  const hote = useRef<HTMLDivElement>(null)
  const [erreur, setErreur] = useState(false)
  useEffect(() => {
    if (!d.animation || !hote.current) return
    let anim: { destroy: () => void } | null = null
    let annule = false
    import('lottie-web/build/player/lottie_light').then(({ default: lottie }) => {
      if (annule || !hote.current) return
      anim = lottie.loadAnimation({ container: hote.current, renderer: 'svg', loop: d.boucle !== false, autoplay: true, path: d.animation! })
      ;(anim as unknown as { addEventListener: (e: string, f: () => void) => void }).addEventListener('data_failed', () => setErreur(true))
    }).catch(() => setErreur(true))
    return () => { annule = true; anim?.destroy() }
  }, [d.animation, d.boucle])
  if (erreur) return <p className="text-sm text-gray-400">{t('Animation indisponible.')}</p>
  return <div ref={hote} className="mx-auto max-w-md aspect-square" />
}

// --- Image à zones cliquables -----------------------------------------------
function Zones({ d, urls }: { d: DonneesInteractif; urls: Urls }) {
  const { t } = useT()
  const [active, setActive] = useState<Zone | null>(null)
  const [vues, setVues] = useState<string[]>([])
  const img = adresse(d.image, urls)
  if (!img) return null
  const zones = d.zones ?? []
  return (
    <div>
      <div className="relative w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img} alt="" className="block w-full rounded-lg" />
        {zones.map((z, i) => (
          <button key={z.id} type="button" onClick={() => { setActive(z); setVues(v => (v.includes(z.id) ? v : [...v, z.id])) }}
            className="absolute rounded-md border-2 border-white/90 bg-white/10 hover:bg-white/30 transition-colors flex items-center justify-center"
            style={{ left: `${z.x}%`, top: `${z.y}%`, width: `${z.l}%`, height: `${z.h}%`, boxShadow: '0 0 0 2px rgba(0,0,0,.25)' }} aria-label={z.titre || t('Zone {n}', { n: i + 1 })}>
            <span className={'w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center text-white ' + (vues.includes(z.id) ? 'bg-green-600' : 'animate-pulse')} style={vues.includes(z.id) ? undefined : { background: accent }}>{vues.includes(z.id) ? '✓' : i + 1}</span>
          </button>
        ))}
      </div>
      {active && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="font-semibold text-gray-900">{active.titre}</p>
          <p className="text-sm text-gray-700 whitespace-pre-line mt-1">{active.texte}</p>
        </div>
      )}
      <p className="text-xs text-gray-400 mt-2">{t('{n}/{total} zone(s) explorée(s)', { n: vues.length, total: zones.length })}</p>
    </div>
  )
}

// --- Trouvez l'erreur -----------------------------------------------------
function Erreurs({ d, urls, onReussi }: { d: DonneesInteractif; urls: Urls; onReussi?: () => void }) {
  const { t } = useT()
  const [trouvees, setTrouvees] = useState<string[]>([])
  const [rates, setRates] = useState<{ x: number; y: number }[]>([])
  const [derniere, setDerniere] = useState<Zone | null>(null)
  const [abandon, setAbandon] = useState(false)
  const img = adresse(d.image, urls)
  const zones = d.zones ?? []
  const fini = zones.length > 0 && trouvees.length === zones.length
  useEffect(() => { if (fini) onReussi?.() }, [fini]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!img) return null
  const clic = (e: React.MouseEvent<HTMLDivElement>) => {
    if (fini || abandon) return
    const r = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * 100, y = ((e.clientY - r.top) / r.height) * 100
    const z = zones.find(z => !trouvees.includes(z.id) && dansZone(z, x, y))
    if (z) { setTrouvees(v => [...v, z.id]); setDerniere(z) }
    else if (!zones.some(z => dansZone(z, x, y))) setRates(v => [...v, { x, y }])
  }
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-3 text-sm">
        <span className="font-semibold text-gray-900">{t('{n}/{total} erreur(s) trouvée(s)', { n: trouvees.length, total: zones.length })}</span>
        {rates.length > 0 && <span className="text-gray-500">{t('{n} clic(s) à côté', { n: rates.length })}</span>}
        {(fini || abandon) && <span className="ml-auto font-semibold" style={{ color: accent }}>{t('Score : {s} %', { s: scoreErreurs(trouvees.length, zones.length, rates.length) })}</span>}
      </div>
      <div className="relative w-full cursor-crosshair" onClick={clic}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img} alt="" className="block w-full rounded-lg select-none pointer-events-none" />
        {zones.filter(z => trouvees.includes(z.id) || abandon).map(z => (
          <span key={z.id} className={'absolute rounded-md border-[3px] ' + (trouvees.includes(z.id) ? 'border-green-500 bg-green-500/15' : 'border-red-500 bg-red-500/15')} style={{ left: `${z.x}%`, top: `${z.y}%`, width: `${z.l}%`, height: `${z.h}%` }} />
        ))}
        {rates.map((p, i) => <span key={i} className="absolute -translate-x-1/2 -translate-y-1/2 text-red-600 font-bold pointer-events-none" style={{ left: `${p.x}%`, top: `${p.y}%` }}>✕</span>)}
      </div>
      {derniere && <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3"><p className="font-semibold text-green-800">✓ {derniere.titre}</p>{derniere.texte && <p className="text-sm text-green-900 mt-1 whitespace-pre-line">{derniere.texte}</p>}</div>}
      {fini && <p className="mt-3 font-semibold text-green-700">🎉 {t('Bravo, vous avez trouvé toutes les erreurs !')}</p>}
      {!fini && !abandon && <button type="button" onClick={() => setAbandon(true)} className="mt-3 text-xs text-gray-500 hover:underline">{t('Je donne ma langue au chat : voir les réponses')}</button>}
      {abandon && !fini && (
        <ul className="mt-3 text-sm text-gray-700 list-disc pl-5 space-y-1">{zones.filter(z => !trouvees.includes(z.id)).map(z => <li key={z.id}><strong>{z.titre}</strong>{z.texte ? ' — ' + z.texte : ''}</li>)}</ul>
      )}
    </div>
  )
}

// --- Mise en situation (scénario à embranchements) ------------------------
function Scenario({ d, urls, onReussi }: { d: DonneesInteractif; urls: Urls; onReussi?: () => void }) {
  const { t } = useT()
  const etapes = d.scenario ?? []
  const [courante, setCourante] = useState<string | null>(etapes[0]?.id ?? null)
  const [choisi, setChoisi] = useState<number | null>(null)
  const [historique, setHistorique] = useState<{ situation: string; choix: string; bon: boolean }[]>([])
  const e = etapes.find(x => x.id === courante) ?? null
  const fini = !e
  const bons = historique.filter(h => h.bon).length
  useEffect(() => { if (fini && historique.length && bons === historique.length) onReussi?.() }, [fini]) // eslint-disable-line react-hooks/exhaustive-deps

  if (fini) {
    return (
      <div>
        <p className="font-semibold text-gray-900 mb-2">{t('Résumé de vos décisions')} — {t('{b}/{n} bonne(s) décision(s)', { b: bons, n: historique.length })}</p>
        <ol className="space-y-2 text-sm">{historique.map((h, i) => <li key={i} className={'rounded-lg border p-3 ' + (h.bon ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50')}><span className="text-gray-600">{h.situation}</span><br /><strong>{h.bon ? '✓' : '✗'} {h.choix}</strong></li>)}</ol>
        <button type="button" onClick={() => { setCourante(etapes[0]?.id ?? null); setHistorique([]); setChoisi(null) }} className="mt-4 px-4 py-2 rounded-lg border border-gray-300 text-sm">↺ {t('Recommencer')}</button>
      </div>
    )
  }
  const img = adresse(e.image ?? null, urls)
  const c = choisi !== null ? e.choix[choisi] : null
  return (
    <div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {img && <img src={img} alt="" className="w-full max-h-72 object-cover rounded-lg mb-4" />}
      <p className="text-gray-900 font-medium whitespace-pre-line">{e.situation}</p>
      <div className="mt-4 space-y-2">
        {e.choix.filter(x => x.texte.trim()).map((x, i) => (
          <button key={i} type="button" disabled={choisi !== null} onClick={() => { setChoisi(i); setHistorique(h => [...h, { situation: e.situation, choix: x.texte, bon: x.bon }]) }}
            className={'w-full text-left rounded-lg border px-4 py-3 text-sm ' + (choisi === null ? 'border-gray-200 hover:border-gray-400' : choisi === i ? (x.bon ? 'border-green-500 bg-green-50' : 'border-red-400 bg-red-50') : 'border-gray-200 opacity-50')}>
            {x.texte}
          </button>
        ))}
      </div>
      {c && (
        <div className={'mt-4 rounded-lg p-4 ' + (c.bon ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200')}>
          <p className="font-semibold">{c.bon ? '✓ ' + t('Bonne décision') : '⚠ ' + t('Conséquence')}</p>
          {c.consequence && <p className="text-sm mt-1 whitespace-pre-line">{c.consequence}</p>}
          <button type="button" onClick={() => { setCourante(c.suite && etapes.some(x => x.id === c.suite) ? c.suite : null); setChoisi(null) }} className="mt-3 px-4 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: accent }}>{c.suite ? t('Continuer') : t('Voir le résumé')} →</button>
        </div>
      )}
    </div>
  )
}

// --- Glisser-déposer (associer ou ordonner) -------------------------------
function melanger<T>(l: T[], graine: number): T[] {
  const r = [...l]
  let s = graine
  for (let i = r.length - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor((s / 233280) * (i + 1)); [r[i], r[j]] = [r[j], r[i]] }
  return r
}

function Glisser({ d, onReussi }: { d: DonneesInteractif; onReussi?: () => void }) {
  const { t } = useT()
  const [verifie, setVerifie] = useState(false)
  const [graine] = useState(() => Math.floor(Math.random() * 10000) + 1)
  // Associer : élément → catégorie choisie
  const paires = (d.paires ?? []).filter(p => p.element.trim() && p.categorie.trim())
  const categories = useMemo(() => Array.from(new Set(paires.map(p => p.categorie))), [paires])
  const elements = useMemo(() => melanger(paires.map(p => p.element), graine), [paires, graine])
  const [place, setPlace] = useState<Record<string, string>>({})
  const [saisi, setSaisi] = useState<string | null>(null)
  // Ordonner
  const bonOrdre = (d.ordre ?? []).filter(x => x.trim())
  const [liste, setListe] = useState<string[]>(() => melanger(bonOrdre, graine))

  const juste = d.variante === 'ordonner'
    ? liste.every((x, i) => x === bonOrdre[i])
    : paires.every(p => place[p.element] === p.categorie)
  useEffect(() => { if (verifie && juste) onReussi?.() }, [verifie, juste]) // eslint-disable-line react-hooks/exhaustive-deps

  if (d.variante === 'ordonner') {
    const deplacer = (i: number, delta: number) => setListe(l => { const r = [...l]; const j = i + delta; if (j < 0 || j >= r.length) return l; [r[i], r[j]] = [r[j], r[i]]; return r })
    return (
      <div>
        <ol className="space-y-2">
          {liste.map((x, i) => (
            <li key={x + i} draggable onDragStart={e => e.dataTransfer.setData('text/plain', String(i))} onDragOver={e => e.preventDefault()}
              onDrop={e => { const de = Number(e.dataTransfer.getData('text/plain')); setListe(l => { const r = [...l]; const [m] = r.splice(de, 1); r.splice(i, 0, m); return r }); setVerifie(false) }}
              className={'flex items-center gap-3 rounded-lg border px-3 py-2 bg-white cursor-grab ' + (verifie ? (x === bonOrdre[i] ? 'border-green-500' : 'border-red-400') : 'border-gray-200')}>
              <span className="text-gray-400">⋮⋮</span><span className="w-6 text-sm font-semibold text-gray-500">{i + 1}.</span><span className="flex-1 text-sm">{x}</span>
              <button type="button" onClick={() => { deplacer(i, -1); setVerifie(false) }} className="text-gray-400 hover:text-gray-800" aria-label={t('Monter')}>▲</button>
              <button type="button" onClick={() => { deplacer(i, 1); setVerifie(false) }} className="text-gray-400 hover:text-gray-800" aria-label={t('Descendre')}>▼</button>
            </li>
          ))}
        </ol>
        <BoutonVerifier verifie={verifie} juste={juste} onVerifier={() => setVerifie(true)} />
      </div>
    )
  }

  const libres = elements.filter(e => !place[e])
  const deposer = (cat: string, el: string | null) => { if (!el) return; setPlace(p => ({ ...p, [el]: cat })); setSaisi(null); setVerifie(false) }
  return (
    <div>
      <div className="flex flex-wrap gap-2 min-h-[44px] rounded-lg border border-dashed border-gray-300 p-2 mb-4">
        {libres.length === 0 ? <span className="text-xs text-gray-400 self-center">{t('Tous les éléments sont placés.')}</span> : libres.map(el => (
          <button key={el} type="button" draggable onDragStart={e => e.dataTransfer.setData('text/plain', el)} onClick={() => setSaisi(saisi === el ? null : el)}
            className={'px-3 py-1.5 rounded-full text-sm border cursor-grab ' + (saisi === el ? 'text-white' : 'bg-white border-gray-300')} style={saisi === el ? { background: accent, borderColor: accent } : undefined}>{el}</button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {categories.map(cat => (
          <div key={cat} onDragOver={e => e.preventDefault()} onDrop={e => deposer(cat, e.dataTransfer.getData('text/plain'))} onClick={() => deposer(cat, saisi)}
            className={'rounded-lg border-2 p-3 min-h-[90px] ' + (saisi ? 'border-dashed cursor-pointer' : 'border-gray-200')} style={saisi ? { borderColor: accent } : undefined}>
            <p className="text-sm font-semibold text-gray-900 mb-2">{cat}</p>
            <div className="flex flex-wrap gap-1.5">
              {elements.filter(el => place[el] === cat).map(el => {
                const bon = paires.find(p => p.element === el)?.categorie === cat
                return <button key={el} type="button" onClick={e => { e.stopPropagation(); setPlace(p => { const r = { ...p }; delete r[el]; return r }); setVerifie(false) }} className={'px-2.5 py-1 rounded-full text-xs border ' + (verifie ? (bon ? 'border-green-500 bg-green-50' : 'border-red-400 bg-red-50') : 'border-gray-300 bg-gray-50')}>{el} ✕</button>
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-2">{t('Glissez chaque élément dans la bonne catégorie (ou touchez l’élément, puis la catégorie).')}</p>
      <BoutonVerifier verifie={verifie} juste={juste} onVerifier={() => setVerifie(true)} desactive={libres.length > 0} />
    </div>
  )
}

function BoutonVerifier({ verifie, juste, onVerifier, desactive }: { verifie: boolean; juste: boolean; onVerifier: () => void; desactive?: boolean }) {
  const { t } = useT()
  return (
    <div className="mt-4 flex items-center gap-3">
      <button type="button" disabled={desactive} onClick={onVerifier} className="px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-40" style={{ background: accent }}>{t('Vérifier')}</button>
      {verifie && <span className={'text-sm font-semibold ' + (juste ? 'text-green-700' : 'text-red-600')}>{juste ? '🎉 ' + t('Tout est juste !') : t('Pas encore : corrigez les éléments en rouge.')}</span>}
    </div>
  )
}
