'use client'
// Champs de connexion : icônes, bouton pour afficher le mot de passe.
import { useState } from 'react'
import { useT } from '@/lib/i18n/client'

const champ: React.CSSProperties = {
  width: '100%', padding: '14px 44px 14px 46px', border: '1px solid rgba(124, 92, 196, 0.25)', borderRadius: '14px',
  fontSize: '16px', boxSizing: 'border-box', outline: 'none', background: 'rgba(255,255,255,0.85)', color: '#1f2937',
}
const icone: React.CSSProperties = { position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#6b5b95', pointerEvents: 'none' }

const Enveloppe = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
)
const Cadenas = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
)
const Oeil = ({ barre }: { barre: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{barre && <path d="m3 3 18 18" />}
  </svg>
)

export default function ChampsConnexion() {
  const { t } = useT()
  const [voir, setVoir] = useState(false)
  return (
    <>
      <div style={{ position: 'relative', marginBottom: '14px' }}>
        <span style={icone}><Enveloppe /></span>
        <input type="email" name="email" autoComplete="email" required aria-label={t('Courriel')} placeholder={t('Adresse courriel')} style={champ} className="champ-connexion" />
      </div>
      <div style={{ position: 'relative', marginBottom: '12px' }}>
        <span style={icone}><Cadenas /></span>
        <input type={voir ? 'text' : 'password'} name="password" autoComplete="current-password" required aria-label={t('Mot de passe')} placeholder={t('Mot de passe')} style={champ} className="champ-connexion" />
        <button type="button" onClick={() => setVoir(v => !v)} aria-label={voir ? t('Masquer le mot de passe') : t('Afficher le mot de passe')} aria-pressed={voir}
          style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: '6px', cursor: 'pointer', color: '#6b5b95', display: 'flex' }}>
          <Oeil barre={voir} />
        </button>
      </div>
    </>
  )
}
