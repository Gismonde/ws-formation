'use client'

import { useState, useEffect } from 'react'
import { useT } from '@/lib/i18n/client'

const STORAGE_KEY = 'ws-formation-privacy-accepted'

export default function PrivacyBanner() {
  const [visible, setVisible] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const { t } = useT()

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) setVisible(true)
  }, [])

  if (!visible) return null

  const handleAccept = () => {
    localStorage.setItem(STORAGE_KEY, 'accepted')
    setVisible(false)
  }

  const handleRefuse = () => {
    localStorage.setItem(STORAGE_KEY, 'refused')
    setVisible(false)
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      background: 'rgba(250, 246, 255, 0.86)',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      borderTop: '1px solid rgba(124, 92, 196, 0.18)',
      color: '#2e2550',
      padding: '12px 20px',
      boxShadow: '0 -6px 20px rgba(91, 61, 160, 0.12)',
      fontFamily: "'Inter', system-ui, sans-serif",
      fontSize: '14px',
    }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 300px' }}>
            <span style={{ fontSize: '18px' }}>🔒</span>
            <span>
              <strong>{t('WS Formation respecte votre vie privée.')}</strong>{' '}
              {t('Nous collectons uniquement les données nécessaires à votre formation.')}{' '}
              <button
                onClick={() => setExpanded(!expanded)}
                style={{ background: 'none', border: 'none', color: '#6d4fd8', fontWeight: 600, cursor: 'pointer', fontSize: '13px', textDecoration: 'underline', padding: 0 }}
              >
                {expanded ? t('Masquer les détails') : t('Voir les détails')}
              </button>
            </span>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
            <button
              onClick={handleRefuse}
              style={{ padding: '6px 18px', border: '1px solid rgba(109, 79, 216, 0.45)', background: 'rgba(255,255,255,0.7)', color: '#5b3fc4', borderRadius: '999px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}
            >
              {t('Refuser')}
            </button>
            <button
              onClick={handleAccept}
              style={{ padding: '6px 18px', border: 'none', background: 'linear-gradient(90deg, #7c6cf2 0%, #a77ce8 50%, #e07ac8 100%)', color: 'white', borderRadius: '999px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
            >
              {t('Accepter')}
            </button>
          </div>
        </div>
        {expanded && (
          <div style={{ marginTop: '12px', padding: '14px 16px', backgroundColor: 'rgba(124, 92, 196, 0.08)', borderRadius: '8px', lineHeight: '1.6', fontSize: '13px' }}>
            <p style={{ margin: '0 0 10px', fontWeight: '600', fontSize: '14px' }}>{t('Politique de confidentialité — WS Formation')}</p>
            <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li><strong>{t('Données collectées :')}</strong> {t('Nom, prénom, courriel professionnel, rôle, progression dans les formations.')}</li>
              <li><strong>{t('Finalité :')}</strong> {t('Gestion des formations, suivi pédagogique, certificats, conformité à la Loi 25 (Québec).')}</li>
              <li><strong>{t('Conservation :')}</strong> {t('Données conservées pendant 5 ans conformément à la réglementation en vigueur.')}</li>
              <li><strong>{t('Partage :')}</strong> {t('Vos données ne sont jamais vendues ni partagées avec des tiers.')}</li>
              <li><strong>{t('Vos droits :')}</strong> {t('Accès, rectification, suppression sur demande auprès de votre administrateur.')}</li>
              <li><strong>{t('Hébergement :')}</strong> {t('Serveurs sécurisés au Canada (Vercel).')}</li>
            </ul>
            <p style={{ margin: '10px 0 0', fontSize: '12px', color: '#5b5675' }}>
              {t('Consultez notre')} <a href="/confidentialite" style={{ color: '#6d4fd8', fontWeight: 600 }}>{t('politique complète')}</a>.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
