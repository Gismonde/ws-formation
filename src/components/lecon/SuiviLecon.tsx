'use client'

// Suivi d'une leçon côté employé :
//  - vidéos obligatoires : on mesure le temps réellement regardé (impossible de « sauter » à la fin)
//  - « J'ai lu et compris » et bouton « Terminer la leçon »

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { enregistrerVideoVue, attesterLecture, terminerLecon, type EtatSuivi } from '@/lib/actions/suivi'

const SEUIL_VISIONNEMENT = 0.9 // 90 % de la durée réellement regardée

type Ctx = {
  videosVues: string[]
  marquerVue: (blocId: string) => void
  suiviActif: boolean
}
const ContexteSuivi = createContext<Ctx>({ videosVues: [], marquerVue: () => {}, suiviActif: false })

export function FournisseurSuivi({ etat, suiviActif, children }: { etat: EtatSuivi; suiviActif: boolean; children: React.ReactNode }) {
  const [videosVues, setVideosVues] = useState<string[]>(etat.videosVues)
  const marquerVue = useCallback((blocId: string) => {
    setVideosVues(v => v.includes(blocId) ? v : [...v, blocId])
    if (suiviActif) enregistrerVideoVue(blocId)
  }, [suiviActif])
  return <ContexteSuivi.Provider value={{ videosVues, marquerVue, suiviActif }}>{children}</ContexteSuivi.Provider>
}

export const useSuivi = () => useContext(ContexteSuivi)

// ---------------------------------------------------------------------------
// Compteur de visionnement réel

function useCompteur(blocId: string, obligatoire: boolean) {
  const { videosVues, marquerVue } = useSuivi()
  const vue = videosVues.includes(blocId)
  const regarde = useRef(0)
  const [pourcentage, setPourcentage] = useState(vue ? 100 : 0)

  const avancer = useCallback((delta: number, duree: number) => {
    if (!obligatoire || vue || !duree) return
    if (delta > 0 && delta < 2.5) regarde.current += delta // un saut dans la vidéo ne compte pas
    const p = Math.min(100, Math.round((regarde.current / duree) * 100))
    setPourcentage(p)
    if (regarde.current >= duree * SEUIL_VISIONNEMENT) marquerVue(blocId)
  }, [obligatoire, vue, marquerVue, blocId])

  return { vue, pourcentage: vue ? 100 : pourcentage, avancer }
}

function BandeauObligatoire({ vue, pourcentage }: { vue: boolean; pourcentage: number }) {
  return (
    <div className={'px-4 py-2 text-xs flex items-center gap-3 ' + (vue ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-800')}>
      {vue ? <span>✅ Vidéo regardée en entier</span> : (
        <>
          <span className="font-semibold">🎯 Vidéo obligatoire</span>
          <span className="flex-1 h-1.5 bg-amber-100 rounded-full overflow-hidden">
            <span className="block h-full bg-amber-500 transition-all" style={{ width: pourcentage + '%' }} />
          </span>
          <span>{pourcentage}%</span>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Lecteurs vidéo

declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement | string, opts: Record<string, unknown>) => { getCurrentTime: () => number; getDuration: () => number; getPlayerState: () => number; destroy: () => void } }
    onYouTubeIframeAPIReady?: () => void
    Vimeo?: { Player: new (el: HTMLElement) => { on: (ev: string, cb: (d: { seconds: number; duration: number }) => void) => void; destroy: () => void } }
  }
}

function chargerScript(src: string): Promise<void> {
  return new Promise((ok, ko) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      const attendre = () => (src.includes('youtube') ? window.YT?.Player : window.Vimeo?.Player) ? ok() : setTimeout(attendre, 100)
      return attendre()
    }
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onerror = () => ko(new Error('script'))
    if (src.includes('youtube')) {
      const precedent = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => { precedent?.(); ok() }
    } else s.onload = () => ok()
    document.head.appendChild(s)
  })
}

export function VideoSuivie({ blocId, titre, src, plateforme, idEnLigne, obligatoire }: {
  blocId: string
  titre: string | null
  src: string
  plateforme: 'fichier' | 'youtube' | 'vimeo'
  idEnLigne?: string
  obligatoire: boolean
}) {
  const { vue, pourcentage, avancer } = useCompteur(blocId, obligatoire)
  const conteneur = useRef<HTMLDivElement>(null)
  const hoteYouTube = useRef<HTMLDivElement>(null)
  const dernier = useRef(0)
  const refAvancer = useRef(avancer)
  refAvancer.current = avancer
  // Lecteur YouTube piloté par son API (créé hors de React) seulement si la vidéo est obligatoire
  const youtubeSuivi = obligatoire && plateforme === 'youtube' && !!idEnLigne

  // YouTube / Vimeo : on lit la position toutes les secondes via leur API officielle
  useEffect(() => {
    if (!obligatoire || plateforme === 'fichier' || !conteneur.current) return
    let detruit = false
    let nettoyer = () => {}
    const el = conteneur.current
    if (youtubeSuivi && hoteYouTube.current) {
      const hote = hoteYouTube.current
      chargerScript('https://www.youtube.com/iframe_api').then(() => {
        if (detruit || !window.YT) return
        const cible = document.createElement('div')
        hote.appendChild(cible)
        const lecteur = new window.YT.Player(cible, {
          videoId: idEnLigne, width: '100%', height: '100%',
          host: 'https://www.youtube-nocookie.com',
          playerVars: { rel: 0, modestbranding: 1 },
        })
        const minuterie = setInterval(() => {
          try {
            if (lecteur.getPlayerState() !== 1) return // 1 = en lecture
            const t = lecteur.getCurrentTime()
            refAvancer.current(t - dernier.current, lecteur.getDuration())
            dernier.current = t
          } catch { /* lecteur pas prêt */ }
        }, 1000)
        nettoyer = () => { clearInterval(minuterie); try { lecteur.destroy() } catch { /* */ } }
      }).catch(() => {})
    }
    if (plateforme === 'vimeo') {
      chargerScript('https://player.vimeo.com/api/player.js').then(() => {
        const iframe = el.querySelector('iframe')
        if (detruit || !window.Vimeo || !iframe) return
        const lecteur = new window.Vimeo.Player(iframe)
        lecteur.on('timeupdate', d => { refAvancer.current(d.seconds - dernier.current, d.duration); dernier.current = d.seconds })
        nettoyer = () => { try { lecteur.destroy() } catch { /* */ } }
      }).catch(() => {})
    }
    return () => { detruit = true; nettoyer() }
  }, [obligatoire, plateforme, idEnLigne, youtubeSuivi])

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {titre && (
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">🎬 {titre}</h3>
        </div>
      )}
      <div ref={conteneur} className="aspect-video bg-black [&>iframe]:w-full [&>iframe]:h-full [&_iframe]:w-full [&_iframe]:h-full">
        {plateforme === 'fichier' ? (
          <video
            src={src} controls controlsList="nodownload" preload="metadata" className="w-full h-full"
            onTimeUpdate={e => {
              const v = e.currentTarget
              avancer(v.currentTime - dernier.current, v.duration)
              dernier.current = v.currentTime
            }}
            onSeeked={e => { dernier.current = e.currentTarget.currentTime }}
          />
        ) : youtubeSuivi ? (
          <div ref={hoteYouTube} className="w-full h-full" />
        ) : (
          <iframe src={src} className="w-full h-full" allowFullScreen title={titre ?? 'Vidéo'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
        )}
      </div>
      {obligatoire && <BandeauObligatoire vue={vue} pourcentage={pourcentage} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Fin de leçon

export function FinDeLecon({ lessonId, attestationRequise, texteAttestation, videosObligatoires, etat, suiviActif }: {
  lessonId: string
  attestationRequise: boolean
  texteAttestation: string
  videosObligatoires: { id: string; titre: string | null }[]
  etat: EtatSuivi
  suiviActif: boolean
}) {
  const { videosVues } = useSuivi()
  const [attestationLe, setAttestationLe] = useState(etat.attestationLe)
  const [termineeLe, setTermineeLe] = useState(etat.termineeLe)
  const [coche, setCoche] = useState(!!etat.attestationLe)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const videosRestantes = videosObligatoires.filter(v => !videosVues.includes(v.id))
  const pret = videosRestantes.length === 0 && (!attestationRequise || coche)
  const date = (iso: string) => new Date(iso).toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'short' })

  if (!suiviActif) {
    return (
      <div className="mt-8 rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">
        Aperçu : les employés verront ici {attestationRequise ? "la case « J'ai lu et compris » et " : ''}le bouton « Terminer la leçon ».
      </div>
    )
  }

  if (termineeLe) {
    return (
      <div className="mt-8 rounded-xl bg-green-50 border border-green-200 p-5 flex items-center gap-3">
        <span className="text-2xl">✅</span>
        <div>
          <p className="font-semibold text-green-800">Leçon terminée</p>
          <p className="text-sm text-green-700">Le {date(termineeLe)}{attestationLe ? ` · attestation signée le ${date(attestationLe)}` : ''}</p>
        </div>
      </div>
    )
  }

  async function terminer() {
    setEnCours(true); setErreur(null)
    if (attestationRequise && !attestationLe) {
      const r = await attesterLecture(lessonId)
      if (!r.ok) { setErreur(r.erreur); setEnCours(false); return }
      setAttestationLe(r.data ?? new Date().toISOString())
    }
    const r = await terminerLecon(lessonId)
    setEnCours(false)
    if (r.ok) setTermineeLe(r.data ?? new Date().toISOString())
    else setErreur(r.manquants?.length ? 'Il reste : ' + r.manquants.join(' · ') : r.erreur)
  }

  return (
    <div className="mt-8 bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h3 className="font-semibold text-gray-900">Terminer la leçon</h3>

      {videosObligatoires.length > 0 && (
        <ul className="space-y-1 text-sm">
          {videosObligatoires.map(v => (
            <li key={v.id} className={videosVues.includes(v.id) ? 'text-green-700' : 'text-gray-600'}>
              {videosVues.includes(v.id) ? '✅' : '⏳'} Vidéo « {v.titre || 'sans titre'} » regardée en entier
            </li>
          ))}
        </ul>
      )}

      {attestationRequise && (
        <label className={'flex items-start gap-3 rounded-lg border p-4 cursor-pointer ' + (coche ? 'border-blue-400 bg-blue-50' : 'border-gray-200')}>
          <input type="checkbox" className="mt-1 w-4 h-4" checked={coche} disabled={!!attestationLe}
            onChange={e => setCoche(e.target.checked)} />
          <span className="text-sm text-gray-800">{texteAttestation}</span>
        </label>
      )}

      {erreur && <p className="text-sm text-red-600">{erreur}</p>}

      <button onClick={terminer} disabled={!pret || enCours}
        className="px-5 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-40">
        {enCours ? 'Enregistrement…' : '✓ Terminer la leçon'}
      </button>
      {!pret && videosRestantes.length > 0 && (
        <p className="text-xs text-gray-500">Regardez d’abord {videosRestantes.length > 1 ? 'les vidéos obligatoires' : 'la vidéo obligatoire'} en entier.</p>
      )}
    </div>
  )
}
