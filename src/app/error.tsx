'use client'
// Page d'erreur : une panne passagère (authentification, base de données) propose de réessayer
// au lieu de renvoyer vers la page de connexion.
import { useEffect } from 'react'
import { useT } from '@/lib/i18n/client'

export default function Erreur({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useT()
  useEffect(() => { console.error(error) }, [error])
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ maxWidth: '420px', textAlign: 'center', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '32px' }}>
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>⚠️</div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>{t('Un problème momentané est survenu')}</h1>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 20px' }}>{t('La connexion au serveur a été interrompue. Vous êtes toujours connecté : réessayez dans un instant.')}</p>
        <button type="button" onClick={() => reset()} style={{ padding: '10px 20px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>{t('Réessayer')}</button>
        {error.digest && <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '16px' }}>{t('Référence : {ref}', { ref: error.digest })}</p>}
      </div>
    </div>
  )
}
