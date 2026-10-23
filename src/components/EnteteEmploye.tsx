'use client'
// Barre du haut du portail employé : recherche et cloche de notifications.
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n/client'
import type { Notification } from '@/lib/notifications'

const CLE_VUES = 'ws_notif_vues'

export default function EnteteEmploye() {
  const { t, loc } = useT()
  const router = useRouter()
  const [q, setQ] = useState('')
  const [notifs, setNotifs] = useState<Notification[] | null>(null)
  const [vues, setVues] = useState<string>('')
  const [ouvert, setOuvert] = useState(false)
  const boite = useRef<HTMLDivElement>(null)

  const charger = useCallback(async () => {
    try {
      const r = await fetch('/api/notifications', { cache: 'no-store' })
      if (r.ok) {
        const d = await r.json() as { notifications: Notification[]; vues_le?: string | null }
        setNotifs(d.notifications)
        // Repère commun à tous les appareils, s'il est plus récent que celui de cet appareil
        if (d.vues_le) setVues(v => (!v || d.vues_le! > v ? d.vues_le! : v))
      }
    } catch { /* hors ligne */ }
  }, [])
  useEffect(() => {
    try { setVues(localStorage.getItem(CLE_VUES) ?? '') } catch { /* */ }
    charger()
    const x = setInterval(charger, 5 * 60_000)
    return () => clearInterval(x)
  }, [charger])
  useEffect(() => {
    if (!ouvert) return
    const fermer = (e: MouseEvent) => { if (boite.current && !boite.current.contains(e.target as Node)) setOuvert(false) }
    const echap = (e: KeyboardEvent) => { if (e.key === 'Escape') setOuvert(false) }
    document.addEventListener('mousedown', fermer); document.addEventListener('keydown', echap)
    return () => { document.removeEventListener('mousedown', fermer); document.removeEventListener('keydown', echap) }
  }, [ouvert])

  const nonLues = (notifs ?? []).filter(n => !vues || n.le > vues).length
  const basculer = () => {
    const suivant = !ouvert
    setOuvert(suivant)
    if (suivant) {
      const maintenant = new Date().toISOString()
      try { localStorage.setItem(CLE_VUES, maintenant) } catch { /* */ }
      fetch('/api/notifications', { method: 'POST' }).catch(() => {})
      // On garde l'ancien repère pendant l'ouverture pour surligner les nouvelles
      setTimeout(() => setVues(maintenant), 4000)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
      <form role="search" onSubmit={e => { e.preventDefault(); if (q.trim()) router.push('/dashboard/recherche?q=' + encodeURIComponent(q.trim())) }} style={{ flex: 1, maxWidth: '520px' }}>
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={t('Rechercher une formation, une politique, une SOP…')} aria-label={t('Rechercher')}
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px 10px 38px', borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '14px', background: '#fff url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 fill=%27none%27 stroke=%27%239ca3af%27 stroke-width=%272%27%3E%3Ccircle cx=%277%27 cy=%277%27 r=%275%27/%3E%3Cpath d=%27m11 11 4 4%27/%3E%3C/svg%3E") no-repeat 13px center', fontFamily: 'inherit' }} />
      </form>
      <div ref={boite} style={{ position: 'relative', marginLeft: 'auto' }}>
        <button type="button" onClick={basculer} aria-expanded={ouvert} aria-label={t('Notifications ({n} non lue(s))', { n: nonLues })}
          style={{ position: 'relative', width: '42px', height: '42px', borderRadius: '12px', border: '1px solid #e5e7eb', background: '#fff', fontSize: '20px', cursor: 'pointer' }}>
          🔔
          {nonLues > 0 && <span style={{ position: 'absolute', top: '-6px', right: '-6px', minWidth: '20px', height: '20px', borderRadius: '999px', background: '#dc2626', color: '#fff', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{nonLues > 9 ? '9+' : nonLues}</span>}
        </button>
        {ouvert && (
          <div role="dialog" aria-label={t('Notifications')} style={{ position: 'absolute', right: 0, top: '50px', width: 'min(380px, calc(100vw - 32px))', maxHeight: '70vh', overflowY: 'auto', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '14px', boxShadow: '0 12px 32px rgba(0,0,0,0.14)', zIndex: 50 }}>
            <p style={{ margin: 0, padding: '12px 16px', fontWeight: 700, fontSize: '14px', borderBottom: '1px solid #f3f4f6' }}>{t('Notifications')}</p>
            {notifs === null ? <p style={{ padding: '16px', fontSize: '13px', color: '#9ca3af', margin: 0 }}>{t('Chargement…')}</p>
              : notifs.length === 0 ? <p style={{ padding: '16px', fontSize: '13px', color: '#6b7280', margin: 0 }}>✓ {t('Rien de nouveau. Vous êtes à jour !')}</p>
              : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {notifs.map(n => {
                    const nouvelle = !vues || n.le > vues
                    return (
                      <li key={n.id}>
                        <Link href={n.lien} onClick={() => setOuvert(false)} style={{ display: 'flex', gap: '10px', padding: '12px 16px', textDecoration: 'none', color: '#111827', borderBottom: '1px solid #f9fafb', background: nouvelle ? '#f8fafc' : '#fff' }}>
                          <span style={{ fontSize: '18px' }}>{n.icone}</span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: 'block', fontSize: '13px', fontWeight: nouvelle ? 700 : 500, color: n.urgent ? '#b91c1c' : '#111827' }}>{t(n.titre, n.vars)}</span>
                            <span style={{ display: 'block', fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{new Date(n.le).toLocaleDateString(loc, { dateStyle: 'medium' })}</span>
                          </span>
                          {nouvelle && <span aria-hidden style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-clinique, #4f46e5)', marginTop: '6px' }} />}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
          </div>
        )}
      </div>
    </div>
  )
}
