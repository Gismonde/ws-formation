'use client'

// Synthèse vocale du navigateur pour la narration des leçons (lecture par morceaux, annulable).
import { useCallback, useEffect, useRef, useState } from 'react'
import { voixPour } from '@/lib/voix'
import { morceaux } from '@/lib/narration'

export type EtatParole = 'arret' | 'lecture' | 'pause'

/** Le navigateur autorise-t-il le son sans nouveau clic ? (faux à l'ouverture directe d'une page) */
export function sonAutorise(): boolean {
  const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation
  return ua ? ua.hasBeenActive : true
}

export function useParole() {
  const [etat, setEtat] = useState<EtatParole>('arret')
  const [vitesse, setVitesse] = useState(1)
  const [bloque, setBloque] = useState(false) // le navigateur a refusé de démarrer sans clic
  const [disponible, setDisponible] = useState(true)
  const voix = useRef<SpeechSynthesisVoice | null>(null)
  const generation = useRef(0)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) { setDisponible(false); return }
    const charger = () => { voix.current = voixPour(window.speechSynthesis.getVoices(), 'fr')[0] ?? null }
    charger()
    window.speechSynthesis.addEventListener('voiceschanged', charger)
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', charger)
      generation.current++
      window.speechSynthesis.cancel()
    }
  }, [])

  const arreter = useCallback(() => {
    generation.current++
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
    setEtat('arret')
  }, [])

  const lire = useCallback((texte: string, onFin?: () => void) => {
    if (!window.speechSynthesis) return
    const g = ++generation.current
    window.speechSynthesis.cancel()
    const file = morceaux(texte)
    if (!file.length) { setEtat('arret'); return }
    setBloque(false)
    let i = 0
    const suivant = () => {
      if (g !== generation.current) return
      if (i >= file.length) { setEtat('arret'); onFin?.(); return }
      const u = new SpeechSynthesisUtterance(file[i++])
      u.lang = 'fr-CA'
      u.rate = vitesse
      if (voix.current) u.voice = voix.current
      u.onend = suivant
      u.onerror = e => {
        if (g !== generation.current) return
        if (e.error === 'not-allowed') { setBloque(true); setEtat('arret'); return }
        if (e.error !== 'interrupted' && e.error !== 'canceled') suivant()
      }
      window.speechSynthesis.speak(u)
    }
    setEtat('lecture')
    suivant()
  }, [vitesse])

  const pause = useCallback(() => { window.speechSynthesis?.pause(); setEtat('pause') }, [])
  const reprendre = useCallback(() => { window.speechSynthesis?.resume(); setEtat('lecture') }, [])

  return { etat, lire, pause, reprendre, arreter, vitesse, setVitesse, bloque, setBloque, disponible }
}
