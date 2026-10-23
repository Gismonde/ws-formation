'use client'
// Mode hors ligne : enregistre le service worker, signale la perte de réseau et envoie le suivi en attente au retour.
import { useEffect, useState } from 'react'
import { useT } from '@/lib/i18n/client'
import { lireFile, viderFile } from '@/lib/file-suivi'

export default function ModeHorsLigne({ utilisateur }: { utilisateur: string | null }) {
  const { t } = useT()
  const [enLigne, setEnLigne] = useState(true)
  const [attente, setAttente] = useState(0)
  const [envoyees, setEnvoyees] = useState(0)

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').then(async () => {
      const reg = await navigator.serviceWorker.ready
      if (utilisateur) reg.active?.postMessage({ type: 'utilisateur', id: utilisateur })
    }).catch(() => {})
  }, [utilisateur])

  useEffect(() => {
    const maj = () => { setEnLigne(navigator.onLine); setAttente(lireFile().length) }
    const retour = async () => { maj(); const n = await viderFile(); if (n) setEnvoyees(n); maj() }
    maj()
    if (navigator.onLine && lireFile().length) retour()
    window.addEventListener('online', retour)
    window.addEventListener('offline', maj)
    window.addEventListener('ws-file-suivi', maj)
    return () => { window.removeEventListener('online', retour); window.removeEventListener('offline', maj); window.removeEventListener('ws-file-suivi', maj) }
  }, [])

  useEffect(() => { if (envoyees) { const x = setTimeout(() => setEnvoyees(0), 6000); return () => clearTimeout(x) } }, [envoyees])

  if (enLigne && !envoyees && !attente) return null
  const style = { position: 'fixed', left: '50%', bottom: '16px', transform: 'translateX(-50%)', zIndex: 60, borderRadius: '999px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, boxShadow: '0 4px 14px rgba(0,0,0,0.15)', maxWidth: 'calc(100% - 32px)', textAlign: 'center' } as const
  if (!enLigne) return <div role="status" style={{ ...style, background: '#1f2937', color: '#fff' }}>📶 {t('Hors ligne : les formations téléchargées restent consultables.')}{attente ? ' ' + t('{n} action(s) en attente d’envoi.', { n: attente }) : ''}</div>
  if (envoyees) return <div role="status" style={{ ...style, background: '#166534', color: '#fff' }}>✓ {t('Progression hors ligne envoyée ({n}).', { n: envoyees })}</div>
  return <div role="status" style={{ ...style, background: '#92400e', color: '#fff' }}>⏳ {t('{n} action(s) en attente d’envoi.', { n: attente })}</div>
}
