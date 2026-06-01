'use client'

import { useState, useEffect } from 'react'

const STORAGE_KEY = 'ws-formation-privacy-accepted'

export default function PrivacyBanner() {
  const [visible, setVisible] = useState(false)
  const [expanded, setExpanded] = useState(false)

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
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      backgroundColor: '#1e3a8a',
      color: 'white',
      padding: '12px 20px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      fontFamily: 'sans-serif',
      fontSize: '14px',
    }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
            <span style={{ fontSize: '18px' }}>🔒</span>
            <span>
              <strong>WS Formation respecte votre vie privée.</strong>{' '}
              Nous collectons uniquement les données nécessaires à votre formation.{' '}
              <button
                onClick={() => setExpanded(!expanded)}
                style={{ background: 'none', border: 'none', color: '#93c5fd', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline', padding: 0 }}
              >
                {expanded ? 'Masquer les détails' : 'Voir les détails'}
              </button>
            </span>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
            <button
              onClick={handleRefuse}
              style={{ padding: '6px 18px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.4)', background: 'transparent', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}
            >
              Refuser
            </button>
            <button
              onClick={handleAccept}
              style={{ padding: '6px 18px', borderRadius: '6px', border: 'none', background: '#3b82f6', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
            >
              Accepter
            </button>
          </div>
        </div>
        {expanded && (
          <div style={{ marginTop: '12px', padding: '14px 16px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '8px', lineHeight: '1.6', fontSize: '13px' }}>
            <p style={{ margin: '0 0 10px', fontWeight: '600', fontSize: '14px' }}>Politique de confidentialité — WS Formation</p>
            <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li><strong>Données collectées :</strong> Nom, prénom, e-mail professionnel, rôle, progression dans les formations.</li>
              <li><strong>Finalité :</strong> Gestion des formations, suivi pédagogique, certificats, conformité RGPD.</li>
              <li><strong>Conservation :</strong> Données conservées pendant 5 ans conformément à la réglementation en vigueur.</li>
              <li><strong>Partage :</strong> Vos données ne sont jamais vendues ni partagées avec des tiers.</li>
              <li><strong>Vos droits :</strong> Accès, rectification, suppression sur demande auprès de votre administrateur.</li>
              <li><strong>Hébergement :</strong> Serveurs sécurisés en Europe (Vercel).</li>
            </ul>
            <p style={{ margin: '10px 0 0', fontSize: '12px', color: '#bfdbfe' }}>
              Consultez notre <a href="/confidentialite" style={{ color: '#93c5fd' }}>politique complète</a>.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
