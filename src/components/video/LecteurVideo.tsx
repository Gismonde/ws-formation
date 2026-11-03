'use client'
// Lecteur vidéo unique (YouTube, Vimeo, fichier) piloté par programme :
// passage (début / fin), lecture de la position, pause / reprise. Utilisé par l'éditeur et par la leçon.
import { useEffect, useRef, useState } from 'react'
import { maxRegarde, positionPermise } from '@/lib/video-avance'
import { useT } from '@/lib/i18n/client'

export type ControleVideo = { temps: () => number; duree: () => number; pause: () => void; lecture: () => void; aller: (s: number) => void }

type Props = {
  plateforme: 'youtube' | 'vimeo' | 'fichier'
  /** Fichier : URL de la vidéo ; YouTube / Vimeo : URL d'intégration */
  src: string
  idEnLigne?: string
  debut?: number
  fin?: number | null
  titre?: string | null
  /** Appelé environ deux fois par seconde pendant la lecture */
  onTemps?: (temps: number, duree: number) => void
  controle?: React.MutableRefObject<ControleVideo | null>
  /** Petit extrait téléversé joué en boucle, sans son ni commandes (comme un GIF) */
  boucle?: boolean
  /** Interdit d'avancer au-delà de ce qui a déjà été regardé (revenir en arrière reste permis) */
  sansAvance?: boolean
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function chargerScript(src: string, pret: () => boolean): Promise<void> {
  return new Promise((ok, ko) => {
    const w = window as any
    if (pret()) return ok()
    if (!document.querySelector(`script[src="${src}"]`)) {
      const s = document.createElement('script')
      s.src = src; s.async = true; s.onerror = () => ko(new Error('script'))
      if (src.includes('youtube')) {
        const precedent = w.onYouTubeIframeAPIReady
        w.onYouTubeIframeAPIReady = () => { precedent?.() }
      }
      document.head.appendChild(s)
    }
    const debut = Date.now()
    const attendre = () => (pret() ? ok() : Date.now() - debut > 15000 ? ko(new Error('délai')) : setTimeout(attendre, 100))
    attendre()
  })
}

export default function LecteurVideo({ plateforme, src, idEnLigne, debut = 0, fin = null, titre, onTemps, controle, boucle = false, sansAvance = false }: Props) {
  const hote = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const rappel = useRef(onTemps)
  rappel.current = onTemps
  // Plus loin point regardé (pour « empêcher d'avancer »)
  const max = useRef(debut)
  const bloquer = useRef(sansAvance)
  bloquer.current = sansAvance
  // YouTube + « empêcher d'avancer » : commandes YouTube masquées (barre de progression, clavier),
  // remplacées par les nôtres, qui ne permettent pas d'aller plus loin que ce qui a été regardé.
  const commandesPerso = useRef(sansAvance && plateforme === 'youtube')
  const yt = useRef<any>(null)
  const [etatYt, setEtatYt] = useState<{ t: number; d: number; lecture: boolean; max: number }>({ t: 0, d: 0, lecture: false, max: 0 })

  // YouTube et Vimeo : lecteur créé par leur API officielle
  useEffect(() => {
    if (plateforme === 'fichier' || !hote.current) return
    const w = window as any
    const el = hote.current
    let detruit = false
    let nettoyer = () => {}

    if (plateforme === 'youtube' && idEnLigne) {
      chargerScript('https://www.youtube.com/iframe_api', () => !!w.YT?.Player).then(() => {
        if (detruit) return
        const cible = document.createElement('div')
        el.appendChild(cible)
        const lecteur = new w.YT.Player(cible, {
          videoId: idEnLigne, width: '100%', height: '100%', host: 'https://www.youtube-nocookie.com',
          playerVars: {
            rel: 0, modestbranding: 1, start: Math.floor(debut), ...(fin ? { end: Math.ceil(fin) } : {}),
            ...(commandesPerso.current ? { controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3 } : {}),
          },
          events: {
            // Contrôle immédiat à chaque reprise de lecture (ex. après un saut)
            onStateChange: (e: { data: number }) => {
              if (bloquer.current && (e.data === 1 || e.data === 3)) {
                try {
                  const retour = positionPermise(max.current, lecteur.getCurrentTime())
                  if (retour !== null) lecteur.seekTo(retour, true)
                } catch { /* */ }
              }
              setEtatYt(x => ({ ...x, lecture: e.data === 1 }))
            },
          },
        })
        yt.current = lecteur
        if (controle) controle.current = {
          temps: () => { try { return lecteur.getCurrentTime() } catch { return 0 } },
          duree: () => { try { return lecteur.getDuration() } catch { return 0 } },
          pause: () => { try { lecteur.pauseVideo() } catch { /* */ } },
          lecture: () => { try { lecteur.playVideo() } catch { /* */ } },
          aller: (s: number) => { try { lecteur.seekTo(s, true) } catch { /* */ } },
        }
        const minuterie = setInterval(() => {
          try {
            if (lecteur.getPlayerState() !== 1) return // 1 = en lecture
            const t = lecteur.getCurrentTime()
            if (bloquer.current) {
              const retour = positionPermise(max.current, t)
              if (retour !== null) { lecteur.seekTo(retour, true); return }
              max.current = maxRegarde(max.current, t)
            }
            if (t < debut - 1) lecteur.seekTo(debut, true)
            if (fin && t >= fin) lecteur.pauseVideo()
            rappel.current?.(t, lecteur.getDuration())
            if (commandesPerso.current) setEtatYt({ t, d: lecteur.getDuration() || 0, lecture: true, max: max.current })
          } catch { /* lecteur pas prêt */ }
        }, 250)
        nettoyer = () => { clearInterval(minuterie); try { lecteur.destroy() } catch { /* */ } }
      }).catch(() => {})
    }

    if (plateforme === 'vimeo') {
      const iframe = el.querySelector('iframe')
      chargerScript('https://player.vimeo.com/api/player.js', () => !!w.Vimeo?.Player).then(() => {
        if (detruit || !iframe) return
        const lecteur = new w.Vimeo.Player(iframe)
        let t = debut, d = 0
        if (debut) lecteur.setCurrentTime(debut).catch(() => {})
        lecteur.getDuration().then((x: number) => { d = x }).catch(() => {})
        if (controle) controle.current = {
          temps: () => t, duree: () => d,
          pause: () => { lecteur.pause().catch(() => {}) },
          lecture: () => { lecteur.play().catch(() => {}) },
          aller: (s: number) => { lecteur.setCurrentTime(s).catch(() => {}) },
        }
        lecteur.on('seeked', (x: { seconds: number }) => {
          if (!bloquer.current) return
          const retour = positionPermise(max.current, x.seconds)
          if (retour !== null) lecteur.setCurrentTime(retour).catch(() => {})
        })
        lecteur.on('timeupdate', (x: { seconds: number; duration: number }) => {
          if (bloquer.current) {
            const retour = positionPermise(max.current, x.seconds)
            if (retour !== null) { lecteur.setCurrentTime(retour).catch(() => {}); return }
            max.current = maxRegarde(max.current, x.seconds)
          }
          t = x.seconds; d = x.duration
          if (t < debut - 1) lecteur.setCurrentTime(debut).catch(() => {})
          if (fin && t >= fin) lecteur.pause().catch(() => {})
          rappel.current?.(t, d)
        })
        nettoyer = () => { try { lecteur.destroy() } catch { /* */ } }
      }).catch(() => {})
    }
    return () => { detruit = true; nettoyer(); if (controle) controle.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plateforme, idEnLigne, src, debut, fin])

  // Fichier : la lecture reste dans le passage (on ne peut ni revenir avant, ni aller après)
  useEffect(() => {
    if (plateforme !== 'fichier' || !controle) return
    const v = video.current
    if (!v) return
    controle.current = {
      temps: () => v.currentTime, duree: () => v.duration || 0,
      pause: () => v.pause(), lecture: () => { v.play().catch(() => {}) }, aller: (s: number) => { v.currentTime = s },
    }
    return () => { controle.current = null }
  }, [plateforme, controle, src])

  if (plateforme === 'fichier' && boucle) {
    return <video src={src} autoPlay muted loop playsInline className="w-full h-full object-contain" aria-label={titre ?? undefined} />
  }
  if (plateforme === 'fichier') {
    return (
      <video
        ref={video} src={src} controls controlsList="nodownload" preload="metadata" className="w-full h-full"
        onLoadedMetadata={e => { if (debut) e.currentTarget.currentTime = debut }}
        onTimeUpdate={e => {
          const v = e.currentTarget
          if (bloquer.current && !v.seeking) max.current = maxRegarde(max.current, v.currentTime)
          if (fin && v.currentTime >= fin) { v.pause(); v.currentTime = fin }
          rappel.current?.(v.currentTime, v.duration)
        }}
        onSeeking={e => {
          const v = e.currentTarget
          if (bloquer.current) { const retour = positionPermise(max.current, v.currentTime); if (retour !== null) { v.currentTime = retour; return } }
          if (v.currentTime < debut) v.currentTime = debut
          else if (fin && v.currentTime > fin) v.currentTime = fin
        }}
      />
    )
  }
  if (plateforme === 'vimeo') {
    const url = src + (debut ? `#t=${Math.floor(debut)}s` : '')
    return (
      <div ref={hote} className="w-full h-full">
        <iframe src={url} className="w-full h-full" allowFullScreen title={titre ?? 'Vidéo'} allow="autoplay; encrypted-media; picture-in-picture" />
      </div>
    )
  }
  if (commandesPerso.current) return <YoutubeCommandes hote={hote} yt={yt} etat={etatYt} max={max} bloquer={bloquer} />
  return <div ref={hote} className="w-full h-full [&_iframe]:w-full [&_iframe]:h-full" />
}

const mmss = (s: number) => { const x = Math.max(0, Math.floor(s)); return `${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}` }

/** Commandes maison pour YouTube : lecture/pause, progression (sans saut en avant), plein écran. */
function YoutubeCommandes({ hote, yt, etat, max, bloquer }: {
  hote: React.RefObject<HTMLDivElement | null>
  yt: React.MutableRefObject<any>
  etat: { t: number; d: number; lecture: boolean; max: number }
  max: React.MutableRefObject<number>
  bloquer: React.MutableRefObject<boolean>
}) {
  const { t } = useT()
  const cadre = useRef<HTMLDivElement>(null)
  const [refus, setRefus] = useState(false)
  const d = etat.d || 0
  const pct = (x: number) => d ? Math.min(100, (x / d) * 100) + '%' : '0%'
  const basculer = () => { try { if (etat.lecture) yt.current?.pauseVideo(); else yt.current?.playVideo() } catch { /* */ } }
  const aller = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!d) return
    const r = e.currentTarget.getBoundingClientRect()
    let cible = ((e.clientX - r.left) / r.width) * d
    if (bloquer.current && cible > max.current + 1) { cible = max.current; setRefus(true); setTimeout(() => setRefus(false), 2500) }
    try { yt.current?.seekTo(cible, true) } catch { /* */ }
  }
  const pleinEcran = () => { const el = cadre.current; if (!el) return; if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else el.requestFullscreen?.().catch(() => {}) }
  return (
    <div ref={cadre} className="relative flex h-full w-full flex-col bg-black">
      <div ref={hote} className="min-h-0 flex-1 [&_iframe]:h-full [&_iframe]:w-full" />
      <div className="flex items-center gap-3 bg-gray-900 px-3 py-2 text-white">
        <button type="button" onClick={basculer} className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/15 hover:bg-white/25" aria-label={etat.lecture ? t('Pause') : t('Lecture')}>
          {etat.lecture ? '⏸' : '▶'}
        </button>
        <span className="flex-shrink-0 text-xs tabular-nums text-white/80">{mmss(etat.t)} / {mmss(d)}</span>
        <div role="slider" aria-label={t('Progression')} aria-valuemin={0} aria-valuemax={Math.round(d)} aria-valuenow={Math.round(etat.t)} tabIndex={-1}
          onClick={aller} className="relative h-2 flex-1 cursor-pointer rounded-full bg-white/20">
          {bloquer.current && <div className="absolute inset-y-0 left-0 rounded-full bg-white/35" style={{ width: pct(etat.max) }} title={t('Déjà regardé')} />}
          <div className="absolute inset-y-0 left-0 rounded-full bg-red-500" style={{ width: pct(etat.t) }} />
          {refus && <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/85 px-2 py-1 text-[11px]">⏩🚫 {t('Regardez la vidéo sans sauter de passage')}</span>}
        </div>
        <button type="button" onClick={pleinEcran} className="flex-shrink-0 rounded px-1.5 text-sm hover:bg-white/15" aria-label={t('Plein écran')}>⛶</button>
      </div>
    </div>
  )
}
