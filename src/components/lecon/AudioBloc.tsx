'use client'

// Fichier audio d'un bloc (mode défilement) : petit lecteur sous le contenu.
// `auto` : tente de démarrer seul ; si le navigateur refuse (aucun clic préalable), on invite à cliquer.
import { useEffect, useRef, useState } from 'react'
import { useT } from '@/lib/i18n/client'

export default function AudioBloc({ src, auto = false }: { src: string; auto?: boolean }) {
  const { t } = useT()
  const ref = useRef<HTMLAudioElement>(null)
  const [refuse, setRefuse] = useState(false)

  useEffect(() => {
    if (!auto || !ref.current) return
    ref.current.play().catch(e => { if ((e as DOMException).name === 'NotAllowedError') setRefuse(true) })
  }, [auto])

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl px-4 py-2 text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #1e1b4b, #312e81)' }}>
      <span className="text-sm font-semibold">🎧 {t('Écouter')}</span>
      {refuse && (
        <button type="button" onClick={() => { setRefuse(false); ref.current?.play().catch(() => {}) }}
          className="animate-pulse rounded-full bg-white px-3 py-1 text-xs font-bold text-indigo-900">
          ▶ {t('Cliquez pour démarrer l’audio')}
        </button>
      )}
      <audio ref={ref} controls preload={auto ? 'auto' : 'metadata'} src={src} className="h-9 min-w-0 flex-1" onPlay={() => setRefuse(false)} />
    </div>
  )
}
