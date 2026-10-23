'use client'
// Lecteur vidéo unique (YouTube, Vimeo, fichier) piloté par programme :
// passage (début / fin), lecture de la position, pause / reprise. Utilisé par l'éditeur et par la leçon.
import { useEffect, useRef } from 'react'

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

export default function LecteurVideo({ plateforme, src, idEnLigne, debut = 0, fin = null, titre, onTemps, controle }: Props) {
  const hote = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const rappel = useRef(onTemps)
  rappel.current = onTemps

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
          playerVars: { rel: 0, modestbranding: 1, start: Math.floor(debut), ...(fin ? { end: Math.ceil(fin) } : {}) },
        })
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
            if (t < debut - 1) lecteur.seekTo(debut, true)
            if (fin && t >= fin) lecteur.pauseVideo()
            rappel.current?.(t, lecteur.getDuration())
          } catch { /* lecteur pas prêt */ }
        }, 500)
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
        lecteur.on('timeupdate', (x: { seconds: number; duration: number }) => {
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

  if (plateforme === 'fichier') {
    return (
      <video
        ref={video} src={src} controls controlsList="nodownload" preload="metadata" className="w-full h-full"
        onLoadedMetadata={e => { if (debut) e.currentTarget.currentTime = debut }}
        onTimeUpdate={e => {
          const v = e.currentTarget
          if (fin && v.currentTime >= fin) { v.pause(); v.currentTime = fin }
          rappel.current?.(v.currentTime, v.duration)
        }}
        onSeeking={e => {
          const v = e.currentTarget
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
  return <div ref={hote} className="w-full h-full [&_iframe]:w-full [&_iframe]:h-full" />
}
