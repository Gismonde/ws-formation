'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '@/lib/i18n/client'

type Images = { cadres: ImageBitmap[]; debuts: number[]; duree: number; l: number; h: number }

/** « 1:05 » */
export function formatTemps(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Index de l'image affichée au temps t (debuts triés). */
export function indexAuTemps(debuts: number[], t: number): number {
  let bas = 0, haut = debuts.length - 1
  while (bas < haut) {
    const m = (bas + haut + 1) >> 1
    if (debuts[m] <= t) bas = m
    else haut = m - 1
  }
  return bas
}

/** Décode un GIF animé en images complètes (avec gestion des modes d'effacement). */
async function decoder(src: string): Promise<Images | null> {
  const { parseGIF, decompressFrames } = await import('gifuct-js')
  const tampon = await fetch(src).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer() })
  const gif = parseGIF(tampon)
  const images = decompressFrames(gif, true)
  if (images.length < 2 || images.length > 400) return null
  const l = gif.lsd.width, h = gif.lsd.height
  const compo = document.createElement('canvas'); compo.width = l; compo.height = h
  const cc = compo.getContext('2d')!
  const morceau = document.createElement('canvas')
  const mc = morceau.getContext('2d')!
  const cadres: ImageBitmap[] = [], debuts: number[] = []
  let t = 0
  for (const im of images) {
    const { width, height, top, left } = im.dims
    const avant = im.disposalType === 3 ? cc.getImageData(0, 0, l, h) : null
    morceau.width = width; morceau.height = height
    mc.putImageData(new ImageData(new Uint8ClampedArray(im.patch), width, height), 0, 0)
    cc.drawImage(morceau, left, top)
    cadres.push(await createImageBitmap(compo))
    debuts.push(t)
    t += Math.max(20, im.delay || 100)
    if (im.disposalType === 2) cc.clearRect(left, top, width, height)
    else if (avant) cc.putImageData(avant, 0, 0)
  }
  return { cadres, debuts, duree: t, l, h }
}

/** Lecteur vidéo pour une démonstration en GIF : aperçu, ▶, barre de progression, durée, plein écran. */
export default function LecteurDemo({ src, titre, alt }: { src: string; titre: string | null; alt: string }) {
  const { t } = useT()
  const [images, setImages] = useState<Images | null>(null)
  const [echec, setEchec] = useState(false)
  const [lecture, setLecture] = useState(false)
  const [temps, setTemps] = useState(0)
  const [vitesse, setVitesse] = useState(1)
  const toile = useRef<HTMLCanvasElement>(null)
  const cadre = useRef<HTMLDivElement>(null)
  const tempsRef = useRef(0)
  const dernier = useRef(-1)

  useEffect(() => {
    let annule = false
    decoder(src).then(r => { if (annule) return; if (r) setImages(r); else setEchec(true) }).catch(() => { if (!annule) setEchec(true) })
    return () => { annule = true }
  }, [src])

  const dessiner = useCallback((ms: number) => {
    if (!images || !toile.current) return
    const i = indexAuTemps(images.debuts, ms)
    if (i === dernier.current) return
    dernier.current = i
    toile.current.getContext('2d')!.drawImage(images.cadres[i], 0, 0)
  }, [images])

  useEffect(() => { if (images) { dernier.current = -1; dessiner(tempsRef.current) } }, [images, dessiner])

  useEffect(() => {
    if (!lecture || !images) return
    let id = 0, prec = performance.now()
    const boucle = (maintenant: number) => {
      const suivant = tempsRef.current + (maintenant - prec) * vitesse
      prec = maintenant
      if (suivant >= images.duree) {
        tempsRef.current = images.duree; setTemps(images.duree); setLecture(false)
        dessiner(images.duree - 1)
        return
      }
      tempsRef.current = suivant; setTemps(suivant); dessiner(suivant)
      id = requestAnimationFrame(boucle)
    }
    id = requestAnimationFrame(boucle)
    return () => cancelAnimationFrame(id)
  }, [lecture, images, vitesse, dessiner])

  const aller = (ms: number) => { tempsRef.current = ms; setTemps(ms); dessiner(Math.min(ms, (images?.duree ?? 1) - 1)) }
  const basculer = () => {
    if (!images) return
    if (!lecture && tempsRef.current >= images.duree) aller(0)
    setLecture(l => !l)
  }
  const pleinEcran = () => {
    const el = cadre.current
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else el.requestFullscreen?.().catch(() => {})
  }

  if (echec) {
    return (
      <figure className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="w-full object-contain max-h-[32rem] bg-gray-50" />
        {titre && <figcaption className="px-6 py-3 text-sm text-gray-600 border-t border-gray-100">{titre}</figcaption>}
      </figure>
    )
  }

  const fini = !!images && temps >= images.duree
  const debut = temps === 0 && !lecture
  const pct = images ? Math.min(100, (temps / images.duree) * 100) : 0

  return (
    <figure className="rounded-xl overflow-hidden bg-gray-900 shadow-lg ring-1 ring-black/10">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide">
          <span aria-hidden>▶</span> {t('Vidéo')}
        </span>
        <span className="text-sm font-medium truncate flex-1">{titre?.replace(/^🎬\s*/, '') || t('Démonstration')}</span>
        {images && <span className="text-xs text-gray-300 tabular-nums">{formatTemps(images.duree)}</span>}
      </div>

      <div ref={cadre} className="relative bg-black flex flex-col justify-center">
        <div className="relative cursor-pointer" onClick={basculer}>
          {images
            ? <canvas ref={toile} width={images.l} height={images.h} aria-label={alt} role="img" className="w-full h-auto max-h-[80vh] object-contain block mx-auto" />
            : <div className="aspect-video flex items-center justify-center text-gray-400 text-sm">{t('Chargement de la vidéo…')}</div>}
          {images && (debut || fini) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/45">
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/95 text-indigo-700 shadow-xl text-3xl pl-1 transition-transform hover:scale-105">
                {fini ? '↻' : '▶'}
              </span>
              <span className="rounded-full bg-black/60 px-4 py-1.5 text-sm font-medium text-white">
                {fini ? t('Revoir la démonstration') : t('Regarder la démonstration')} · {formatTemps(images.duree)}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 px-3 py-2 bg-gray-900 text-white">
          <button type="button" onClick={basculer} disabled={!images}
            aria-label={lecture ? t('Pause') : t('Lecture')}
            className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-white/15 disabled:opacity-40">
            {lecture ? '❚❚' : fini ? '↻' : '▶'}
          </button>
          <span className="text-xs tabular-nums text-gray-300 w-20 shrink-0">{formatTemps(temps)} / {images ? formatTemps(images.duree) : '–:––'}</span>
          <input type="range" min={0} max={images?.duree ?? 1} step={10} value={Math.min(temps, images?.duree ?? 0)}
            disabled={!images} aria-label={t('Position dans la vidéo')}
            onChange={e => aller(Number(e.target.value))}
            style={{ background: `linear-gradient(to right, #818cf8 ${pct}%, rgba(255,255,255,.25) ${pct}%)` }}
            className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer accent-indigo-400" />
          <select value={vitesse} onChange={e => setVitesse(Number(e.target.value))} aria-label={t('Vitesse')}
            className="bg-transparent text-xs text-gray-200 border border-white/20 rounded px-1 py-0.5">
            {[0.5, 1, 1.5, 2].map(v => <option key={v} value={v} className="text-gray-900">{v}×</option>)}
          </select>
          <button type="button" onClick={pleinEcran} aria-label={t('Plein écran')}
            className="h-8 w-8 flex items-center justify-center rounded hover:bg-white/15">⛶</button>
        </div>
      </div>
    </figure>
  )
}
