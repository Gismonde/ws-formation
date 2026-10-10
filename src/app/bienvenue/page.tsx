import { Suspense } from 'react'
import BienvenueForm from './BienvenueForm'

export const metadata = { title: 'Bienvenue — WS Formation' }

export default function BienvenuePage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f4ff', fontFamily: 'sans-serif', padding: '16px' }}>
      <div style={{ backgroundColor: 'white', padding: '36px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', width: '100%', maxWidth: '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '12px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/wssc.png" alt="WSSC" style={{ height: '40px' }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/cmc.png" alt="CMC" style={{ height: '40px' }} />
          </div>
          <h1 style={{ margin: '0 0 4px', fontSize: '22px', color: '#1e40af' }}>Bienvenue sur WS Formation</h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>Choisissez votre mot de passe pour activer votre compte.</p>
        </div>
        <Suspense fallback={null}>
          <BienvenueForm />
        </Suspense>
      </div>
    </div>
  )
}
