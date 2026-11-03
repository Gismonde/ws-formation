'use client'

// Mode « présentation » d'une leçon : un écran à la fois, comme un diaporama.
// Tous les écrans restent montés (cachés) pour garder l'état des vidéos et des exercices.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useT } from '@/lib/i18n/client'
import { useParole, sonAutorise } from '@/lib/parole-client'

export default function Diaporama({ titre, description, couverture, accent, ecrans, fin, narrations = [], audioAuto = false }: {
  titre: string
  description?: string | null
  couverture?: string | null
  accent?: string | null
  ecrans: ReactNode[]
  /** Fin de leçon (attestation, « Terminer la leçon ») : sous le dernier écran */
  fin: ReactNode
  /** Texte lu à voix haute pour chaque écran (index 0 = écran titre) */
  narrations?: string[]
  /** La narration démarre d'elle-même à chaque écran */
  audioAuto?: boolean
}) {
  const { t } = useT()
  const total = ecrans.length
  const [i, setI] = useState(0) // 0 = écran titre
  const couleur = accent || '#4f46e5'
  const parole = useParole()
  const [audioActif, setAudioActif] = useState(audioAuto)
  const aNarration = parole.disponible && narrations.some(n => n && n.trim())
  const narrationIci = narrations[i] ?? ''
  const lireRef = useRef(parole.lire)
  lireRef.current = parole.lire
  const { arreter, setBloque } = parole

  // À chaque écran : on lit sa narration (si l'audio est activé), sinon on coupe
  useEffect(() => {
    if (!audioActif || !narrationIci) { arreter(); return }
    if (!sonAutorise()) { arreter(); setBloque(true); return }
    lireRef.current(narrationIci)
  }, [i, audioActif, narrationIci, arreter, setBloque])
  const aller = useCallback((n: number) => {
    setI(Math.max(0, Math.min(total, n)))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [total])

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement | null
      if (cible && (cible.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(cible.tagName))) return
      if (e.key === 'ArrowRight') aller(i + 1)
      if (e.key === 'ArrowLeft') aller(i - 1)
    }
    window.addEventListener('keydown', touche)
    return () => window.removeEventListener('keydown', touche)
  }, [i, aller])

  return (
    <div>
      {/* Progression */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex flex-1 gap-1" aria-hidden>
          {Array.from({ length: total + 1 }, (_, k) => (
            <button key={k} type="button" onClick={() => aller(k)} tabIndex={-1}
              className="h-1.5 flex-1 rounded-full transition-colors" style={{ background: k <= i ? couleur : '#e5e7eb' }} />
          ))}
        </div>
        <span className="text-xs tabular-nums text-gray-500">{i === 0 ? t('Début') : t('Écran {n} sur {total}', { n: i, total })}</span>
      </div>

      {/* Narration audio */}
      {aNarration && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl px-4 py-2.5 text-white shadow" style={{ background: 'linear-gradient(135deg, #1e1b4b, #312e81)' }}>
          <span aria-hidden>🎧</span>
          {!audioActif ? (
            <button type="button" onClick={() => setAudioActif(true)} className="rounded-full bg-white px-4 py-1.5 text-sm font-bold text-indigo-900 hover:bg-indigo-50">
              ▶ {t('Écouter la narration')}
            </button>
          ) : parole.bloque ? (
            <button type="button" onClick={() => narrationIci && parole.lire(narrationIci)} className="animate-pulse rounded-full bg-white px-4 py-1.5 text-sm font-bold text-indigo-900">
              ▶ {t('Cliquez pour démarrer l’audio')}
            </button>
          ) : (
            <>
              <button type="button" disabled={!narrationIci}
                onClick={() => parole.etat === 'lecture' ? parole.pause() : parole.etat === 'pause' ? parole.reprendre() : parole.lire(narrationIci)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-indigo-900 disabled:opacity-40" title={parole.etat === 'lecture' ? t('Pause') : t('Lire')}>
                {parole.etat === 'lecture' ? '⏸' : '▶'}
              </button>
              <button type="button" disabled={!narrationIci} onClick={() => parole.lire(narrationIci)} className="rounded-full px-2 py-1 text-sm text-indigo-100 hover:bg-white/10 disabled:opacity-40" title={t('Réécouter')}>↻</button>
              <span className="text-sm text-indigo-100">
                {!narrationIci ? t('Pas de narration sur cet écran') : parole.etat === 'lecture' ? t('Lecture en cours…') : parole.etat === 'pause' ? t('En pause') : t('Narration terminée')}
              </span>
            </>
          )}
          <div className="ml-auto flex items-center gap-2">
            <select value={parole.vitesse} onChange={e => parole.setVitesse(Number(e.target.value))} title={t('Vitesse')}
              className="rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-xs text-white">
              {[0.75, 1, 1.25, 1.5].map(v => <option key={v} value={v} className="text-black">{v}×</option>)}
            </select>
            {audioActif && (
              <button type="button" onClick={() => setAudioActif(false)} className="rounded-full px-2 py-1 text-xs text-indigo-100 hover:bg-white/10">🔇 {t('Couper le son')}</button>
            )}
          </div>
        </div>
      )}

      {/* Écran titre */}
      <section hidden={i !== 0} className="relative overflow-hidden rounded-3xl shadow-lg" style={{ background: couleur }}>
        {couverture && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={couverture} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        )}
        <div className="relative flex min-h-[60vh] flex-col items-center justify-center bg-black/35 px-6 py-16 text-center text-white">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl drop-shadow">{titre}</h2>
          {description && <p className="mt-4 max-w-xl text-lg text-white/90 drop-shadow">{description}</p>}
          {total > 0 && (
            <button type="button" onClick={() => aller(1)} className="mt-8 rounded-full bg-white px-8 py-3 text-lg font-bold shadow-lg transition hover:scale-105" style={{ color: couleur }}>
              {t('Commencer')} →
            </button>
          )}
        </div>
      </section>

      {/* Écrans */}
      {ecrans.map((contenu, k) => (
        <section key={k} hidden={i !== k + 1} className="diapo rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="flex min-h-[50vh] flex-col justify-center gap-6">{contenu}</div>
        </section>
      ))}

      {/* Fin de leçon sous le dernier écran (ou directement s'il n'y a aucun écran) */}
      <div hidden={i !== total}>{fin}</div>

      {/* Navigation */}
      {i > 0 && (
        <div className="mt-6 flex items-center justify-between">
          <button type="button" onClick={() => aller(i - 1)} className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 font-semibold text-gray-700 hover:bg-gray-50">← {t('Précédent')}</button>
          {i < total && (
            <button type="button" onClick={() => aller(i + 1)} className="rounded-xl px-6 py-2.5 font-bold text-white shadow hover:opacity-90" style={{ background: couleur }}>{t('Suivant')} →</button>
          )}
        </div>
      )}
      <p className="mt-3 text-center text-xs text-gray-400">{t('Astuce : les flèches ← → du clavier changent d’écran.')}</p>
    </div>
  )
}
