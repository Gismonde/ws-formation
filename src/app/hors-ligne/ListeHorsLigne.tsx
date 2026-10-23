'use client'
import { useEffect, useState } from 'react'
import { useT } from '@/lib/i18n/client'

export default function ListeHorsLigne() {
  const { t } = useT()
  const [liste, setListe] = useState<{ id: string; titre: string; le: string }[]>([])
  useEffect(() => { try { setListe(JSON.parse(localStorage.getItem('ws_hors_ligne_liste') ?? '[]')) } catch { /* */ } }, [])
  return (
    <>
      <p style={{ fontSize: '40px', margin: 0 }}>📶</p>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827' }}>{t('Vous êtes hors ligne')}</h1>
      <p style={{ color: '#4b5563', fontSize: '15px', lineHeight: 1.6 }}>{t('Cette page n’a pas été téléchargée sur cet appareil. Les formations rendues disponibles hors ligne restent consultables ; votre progression sera envoyée au retour du réseau.')}</p>
      {liste.length > 0 && (
        <>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#374151', marginTop: '24px' }}>{t('Formations disponibles sur cet appareil')}</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {liste.map(f => (
              <li key={f.id} style={{ marginBottom: '8px' }}>
                <a href={`/formations/${f.id}`} style={{ display: 'block', padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: '12px', color: '#111827', textDecoration: 'none', fontWeight: 600 }}>🎓 {f.titre}</a>
              </li>
            ))}
          </ul>
        </>
      )}
      <button type="button" onClick={() => location.reload()} style={{ marginTop: '16px', padding: '10px 18px', borderRadius: '10px', border: '1px solid #d1d5db', background: '#fff', fontWeight: 600, cursor: 'pointer' }}>{t('Réessayer')}</button>
    </>
  )
}
