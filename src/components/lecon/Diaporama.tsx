'use client'

// Mode « présentation » d'une leçon : un écran à la fois, comme un diaporama.
// Tous les écrans restent montés (cachés) pour garder l'état des vidéos et des exercices.
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useT } from '@/lib/i18n/client'

export default function Diaporama({ titre, description, couverture, accent, ecrans, fin }: {
  titre: string
  description?: string | null
  couverture?: string | null
  accent?: string | null
  ecrans: ReactNode[]
  /** Fin de leçon (attestation, « Terminer la leçon ») : sous le dernier écran */
  fin: ReactNode
}) {
  const { t } = useT()
  const total = ecrans.length
  const [i, setI] = useState(0) // 0 = écran titre
  const couleur = accent || '#4f46e5'
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
