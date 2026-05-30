'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function MfaVerifyPage() {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [factorId, setFactorId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function chargerFacteur() {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error || !data) return
      const totp = data.totp.find(f => f.status === 'verified')
      if (totp) setFactorId(totp.id)
    }
    chargerFacteur()
  }, [])

  async function verifier() {
    if (!factorId || code.length !== 6) return
    setLoading(true)
    setError(null)

    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
    if (challengeError || !challengeData) {
      setError('Erreur lors de la vérification. Veuillez réessayer.')
      setLoading(false)
      return
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code: code.replace(/\s/g, ''),
    })

    if (verifyError) {
      setError('Code incorrect. Vérifiez votre application et réessayez.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#f0f4ff', fontFamily: 'sans-serif',
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: '16px', padding: '40px',
        width: '100%', maxWidth: '400px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>🛡️</div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1a1f36', margin: 0 }}>
            Vérification en deux étapes
          </h1>
          <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '8px' }}>
            Saisissez le code à 6 chiffres de votre application d&apos;authentification.
          </p>
        </div>

        {error && (
          <div style={{
            padding: '12px 16px', borderRadius: '8px', marginBottom: '20px',
            backgroundColor: '#fef2f2', border: '1px solid #fecaca',
            color: '#991b1b', fontSize: '14px', textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
          onKeyDown={e => e.key === 'Enter' && verifier()}
          autoFocus
          style={{
            width: '100%', padding: '14px', borderRadius: '10px',
            border: '2px solid #e5e7eb', fontSize: '24px', textAlign: 'center',
            letterSpacing: '10px', boxSizing: 'border-box', marginBottom: '16px',
            outline: 'none', transition: 'border-color 0.2s',
          }}
          onFocus={e => { e.target.style.borderColor = '#4f46e5' }}
          onBlur={e => { e.target.style.borderColor = '#e5e7eb' }}
        />

        <button
          onClick={verifier}
          disabled={code.length !== 6 || loading}
          style={{
            width: '100%', padding: '13px', borderRadius: '10px',
            backgroundColor: code.length === 6 && !loading ? '#4f46e5' : '#e5e7eb',
            color: code.length === 6 && !loading ? 'white' : '#9ca3af',
            border: 'none', cursor: code.length === 6 && !loading ? 'pointer' : 'not-allowed',
            fontWeight: '600', fontSize: '15px', marginBottom: '16px',
          }}
        >
          {loading ? 'Vérification...' : 'Confirmer'}
        </button>

        <p style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center', margin: 0 }}>
          Problème d&apos;accès ? Contactez votre administrateur.
        </p>
      </div>
    </div>
  )
}
