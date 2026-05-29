'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface AudioReaderProps {
  text: string
  title?: string
}

export default function AudioReader({ text, title }: AudioReaderProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const [rate, setRate] = useState(1)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selectedVoice, setSelectedVoice] = useState<string>('')
  const [supported, setSupported] = useState(true)
  const [currentWord, setCurrentWord] = useState('')
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const wordsRef = useRef<string[]>([])
  const wordIndexRef = useRef(0)

  // Load available voices
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setSupported(false)
      return
    }

    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices()
      // Prefer French voices
      const frenchVoices = v.filter(voice => voice.lang.startsWith('fr'))
      const allVoices = frenchVoices.length > 0 ? frenchVoices : v
      setVoices(allVoices)
      if (allVoices.length > 0 && !selectedVoice) {
        setSelectedVoice(allVoices[0].name)
      }
    }

    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices
    return () => { window.speechSynthesis.onvoiceschanged = null }
  }, [selectedVoice])

  const cleanText = useCallback((raw: string) => {
    return raw
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
      .replace(/_{1,2}([^_]+)_{1,2}/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\n{2,}/g, '. ')
      .replace(/\n/g, ' ')
      .trim()
  }, [])

  const stop = useCallback(() => {
    window.speechSynthesis.cancel()
    setIsPlaying(false)
    setIsPaused(false)
    setProgress(0)
    setCurrentWord('')
    wordIndexRef.current = 0
  }, [])

  const play = useCallback(() => {
    if (!window.speechSynthesis) return

    // Resume if paused
    if (isPaused) {
      window.speechSynthesis.resume()
      setIsPlaying(true)
      setIsPaused(false)
      return
    }

    // Cancel any current speech
    window.speechSynthesis.cancel()

    const cleanedText = cleanText(text)
    wordsRef.current = cleanedText.split(/\s+/)
    wordIndexRef.current = 0

    const utterance = new SpeechSynthesisUtterance(cleanedText)
    utterance.rate = rate
    utterance.pitch = 1
    utterance.volume = 1

    // Apply selected voice
    const voice = voices.find(v => v.name === selectedVoice)
    if (voice) utterance.voice = voice

    // Track word progress
    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        const words = wordsRef.current
        wordIndexRef.current++
        setProgress(Math.round((wordIndexRef.current / words.length) * 100))
        // Show current word being spoken
        const charIndex = event.charIndex
        const substr = cleanedText.substring(charIndex)
        const wordMatch = substr.match(/^\S+/)
        if (wordMatch) setCurrentWord(wordMatch[0])
      }
    }

    utterance.onstart = () => {
      setIsPlaying(true)
      setIsPaused(false)
      setProgress(0)
    }

    utterance.onend = () => {
      setIsPlaying(false)
      setIsPaused(false)
      setProgress(100)
      setCurrentWord('')
      setTimeout(() => setProgress(0), 2000)
    }

    utterance.onerror = () => {
      setIsPlaying(false)
      setIsPaused(false)
    }

    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }, [text, rate, voices, selectedVoice, isPaused, cleanText])

  const pause = useCallback(() => {
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause()
      setIsPlaying(false)
      setIsPaused(true)
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => { window.speechSynthesis?.cancel() }
  }, [])

  if (!supported) {
    return (
      <div style={{
        padding: '12px 16px',
        background: '#fef9c3',
        border: '1px solid #fde047',
        borderRadius: '8px',
        fontSize: '13px',
        color: '#713f12',
      }}>
        La lecture audio n&apos;est pas supportée par ce navigateur.
      </div>
    )
  }

  const btnBase: React.CSSProperties = {
    border: 'none',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'all 0.2s',
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
      borderRadius: '12px',
      padding: '16px 20px',
      color: '#fff',
      userSelect: 'none',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <span style={{ fontSize: '18px' }}>🔊</span>
        <div>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#c7d2fe' }}>Lecture audio</p>
          {title && <p style={{ margin: 0, fontSize: '12px', color: '#818cf8' }}>{title}</p>}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        height: '4px',
        background: 'rgba(255,255,255,0.15)',
        borderRadius: '4px',
        marginBottom: '14px',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          background: progress === 100 ? '#4ade80' : '#818cf8',
          borderRadius: '4px',
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Current word */}
      <div style={{ minHeight: '20px', marginBottom: '12px', textAlign: 'center' }}>
        {currentWord && (
          <span style={{
            fontSize: '13px',
            color: '#c7d2fe',
            fontStyle: 'italic',
            background: 'rgba(255,255,255,0.1)',
            padding: '2px 10px',
            borderRadius: '12px',
          }}>
            {currentWord}
          </span>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', marginBottom: '14px' }}>
        {/* Stop */}
        <button
          onClick={stop}
          disabled={!isPlaying && !isPaused}
          style={{
            ...btnBase,
            background: (isPlaying || isPaused) ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)',
            color: (isPlaying || isPaused) ? '#fca5a5' : 'rgba(255,255,255,0.4)',
            cursor: (isPlaying || isPaused) ? 'pointer' : 'default',
          }}
          title="Arrêter"
        >
          ⏹
        </button>

        {/* Play / Pause */}
        <button
          onClick={isPlaying ? pause : play}
          style={{
            ...btnBase,
            width: '52px',
            height: '52px',
            fontSize: '22px',
            background: isPlaying ? '#6366f1' : '#4f46e5',
            color: '#fff',
            boxShadow: '0 4px 12px rgba(99,102,241,0.5)',
          }}
          title={isPlaying ? 'Pause' : isPaused ? 'Reprendre' : 'Lire'}
        >
          {isPlaying ? '⏸' : '▶️'}
        </button>

        {/* Speed selector */}
        <select
          value={rate}
          onChange={e => setRate(Number(e.target.value))}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            color: '#fff',
            padding: '4px 8px',
            fontSize: '12px',
            cursor: 'pointer',
          }}
          title="Vitesse"
        >
          <option value={0.75} style={{ color: '#000' }}>0.75×</option>
          <option value={1} style={{ color: '#000' }}>1×</option>
          <option value={1.25} style={{ color: '#000' }}>1.25×</option>
          <option value={1.5} style={{ color: '#000' }}>1.5×</option>
          <option value={2} style={{ color: '#000' }}>2×</option>
        </select>
      </div>

      {/* Voice selector */}
      {voices.length > 1 && (
        <div>
          <select
            value={selectedVoice}
            onChange={e => {
              setSelectedVoice(e.target.value)
              if (isPlaying) {
                stop()
                setTimeout(play, 100)
              }
            }}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '8px',
              color: '#c7d2fe',
              padding: '6px 10px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            {voices.map(v => (
              <option key={v.name} value={v.name} style={{ color: '#000', background: '#fff' }}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Status */}
      <p style={{ margin: '10px 0 0', textAlign: 'center', fontSize: '11px', color: 'rgba(199,210,254,0.6)' }}>
        {isPlaying ? 'Lecture en cours...' : isPaused ? 'En pause' : progress === 100 ? '✓ Terminé' : 'Prêt à lire'}
      </p>
    </div>
  )
      }
