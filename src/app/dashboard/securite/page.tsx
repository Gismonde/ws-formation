'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type Factor = {
  id: string
  friendly_name: string | null
  factor_type: string
  status: string
  created_at: string
  updated_at: string
}

export default function SecuritePage() {
  const [factors, setFactors] = useState<Factor[]>([])
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<'liste' | 'enroll'>('liste')
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    chargerFacteurs()
  }, [])

  async function chargerFacteurs() {
    setLoading(true)
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (!error && data) {
      setFactors(data.totp || [])
    }
    setLoading(false)
  }

  async function demarrerEnrollment() {
    setMessage(null)
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Application Authenticator',
    })
    if (error || !data) {
      setMessage({ type: 'error', text: 'Erreur lors de la configuration : ' + (error?.message || 'inconnue') })
      return
    }
    setQrCode(data.totp.qr_code)
    setSecret(data.totp.secret)
    setFactorId(data.id)
    setStep('enroll')
  }

  async function verifierCode() {
    if (!factorId) return
    setMessage(null)
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
    if (challengeError || !challengeData) {
      setMessage({ type: 'error', text: 'Erreur challenge MFA : ' + (challengeError?.message || 'inconnue') })
      return
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code: code.replace(/\s/g, ''),
    })
    if (verifyError) {
      setMessage({ type: 'error', text: 'Code incorrect. Vérifiez votre application et réessayez.' })
      return
    }
    setMessage({ type: 'success', text: 'Double authentification activée avec succès !' })
    setStep('liste')
    setCode('')
    setQrCode(null)
    setSecret(null)
    setFactorId(null)
    await chargerFacteurs()
  }

  async function supprimerFacteur(id: string) {
    setDeleting(id)
    setMessage(null)
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id })
    if (error) {
      setMessage({ type: 'error', text: 'Erreur lors de la désactivation : ' + error.message })
    } else {
      setMessage({ type: 'success', text: 'Double authentification désactivée.' })
      await chargerFacteurs()
    }
    setDeleting(null)
  }

  function annuler() {
    setStep('liste')
    setQrCode(null)
    setSecret(null)
    setFactorId(null)
    setCode('')
    setMessage(null)
  }

  const facteurActif = factors.filter(f => f.status === 'verified')
  const mfaActive = facteurActif.length > 0

  if (loading) {
    return (
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '32px 16px' }}>
        <p style={{ color: '#6b7280' }}>Chargement...</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1a1f36', margin: 0 }}>
          Sécurité du compte
        </h1>
        <p style={{ color: '#6b7280', marginTop: '8px', fontSize: '14px' }}>
          Gérez la double authentification (2FA) pour protéger votre compte.
        </p>
      </div>

      {message && (
        <div style={{
          padding: '12px 16px', borderRadius: '8px', marginBottom: '24px',
          backgroundColor: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: message.type === 'success' ? '1px solid #bbf7d0' : '1px solid #fecaca',
          color: message.type === 'success' ? '#166534' : '#991b1b',
          fontSize: '14px',
        }}>
          {message.text}
        </div>
      )}

      <div style={{
        backgroundColor: 'white', border: '1px solid #e5e7eb',
        borderRadius: '12px', padding: '24px', marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '8px',
              backgroundColor: mfaActive ? '#f0fdf4' : '#f9fafb',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px',
            }}>
              {mfaActive ? '🛡️' : '🔓'}
            </div>
            <div>
              <div style={{ fontWeight: '600', color: '#1a1f36', fontSize: '15px' }}>
                Double authentification (2FA)
              </div>
              <div style={{ fontSize: '13px', color: mfaActive ? '#16a34a' : '#6b7280', marginTop: '2px' }}>
                {mfaActive ? 'Activée — votre compte est protégé' : "Désactivée — recommandé de l'activer"}
              </div>
            </div>
          </div>
          <span style={{
            padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
            backgroundColor: mfaActive ? '#dcfce7' : '#f3f4f6',
            color: mfaActive ? '#16a34a' : '#6b7280',
          }}>
            {mfaActive ? 'ACTIVE' : 'INACTIVE'}
          </span>
        </div>

        {!mfaActive && step === 'liste' && (
          <button
            onClick={demarrerEnrollment}
            style={{
              width: '100%', padding: '10px 16px', borderRadius: '8px',
              backgroundColor: '#4f46e5', color: 'white', border: 'none',
              cursor: 'pointer', fontWeight: '600', fontSize: '14px',
            }}
          >
            Activer la double authentification
          </button>
        )}

        {mfaActive && facteurActif.map(f => (
          <div key={f.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px',
            border: '1px solid #e5e7eb',
          }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1f36' }}>
                {f.friendly_name || 'Application Authenticator'}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                Configurée le {new Date(f.created_at).toLocaleDateString('fr-CA')}
              </div>
            </div>
            <button
              onClick={() => supprimerFacteur(f.id)}
              disabled={deleting === f.id}
              style={{
                padding: '6px 12px', borderRadius: '6px', fontSize: '13px',
                backgroundColor: 'white', color: '#dc2626', border: '1px solid #fecaca',
                cursor: deleting === f.id ? 'not-allowed' : 'pointer', fontWeight: '500',
                opacity: deleting === f.id ? 0.6 : 1,
              }}
            >
              {deleting === f.id ? 'Désactivation...' : 'Désactiver'}
            </button>
          </div>
        ))}
      </div>

      {step === 'enroll' && qrCode && (
        <div style={{
          backgroundColor: 'white', border: '1px solid #e5e7eb',
          borderRadius: '12px', padding: '24px', marginBottom: '24px',
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#1a1f36', marginTop: 0, marginBottom: '8px' }}>
            Étape 1 — Scannez le QR code
          </h2>
          <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '20px' }}>
            Ouvrez votre application d&apos;authentification (Google Authenticator, Authy, etc.) et scannez ce code.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <img src={qrCode} alt="QR Code 2FA" width={200} height={200} style={{ border: '1px solid #e5e7eb', borderRadius: '8px' }} />
          </div>
          {secret && (
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>
                Ou entrez ce code manuellement :
              </p>
              <code style={{
                fontSize: '13px', letterSpacing: '2px', backgroundColor: '#f3f4f6',
                padding: '8px 16px', borderRadius: '6px', display: 'inline-block',
                color: '#1a1f36', wordBreak: 'break-all',
              }}>
                {secret}
              </code>
            </div>
          )}
          <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#1a1f36', marginBottom: '8px' }}>
            Étape 2 — Entrez le code de vérification
          </h2>
          <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px' }}>
            Saisissez le code à 6 chiffres affiché dans votre application.
          </p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: '8px',
              border: '1px solid #d1d5db', fontSize: '20px', textAlign: 'center',
              letterSpacing: '8px', boxSizing: 'border-box', marginBottom: '16px',
            }}
          />
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={annuler} style={{
              flex: 1, padding: '10px', borderRadius: '8px', fontSize: '14px',
              backgroundColor: 'white', color: '#6b7280', border: '1px solid #e5e7eb',
              cursor: 'pointer', fontWeight: '500',
            }}>
              Annuler
            </button>
            <button onClick={verifierCode} disabled={code.length !== 6} style={{
              flex: 2, padding: '10px', borderRadius: '8px', fontSize: '14px',
              backgroundColor: code.length === 6 ? '#4f46e5' : '#e5e7eb',
              color: code.length === 6 ? 'white' : '#9ca3af',
              border: 'none', cursor: code.length === 6 ? 'pointer' : 'not-allowed', fontWeight: '600',
            }}>
              Confirmer et activer
            </button>
          </div>
        </div>
      )}

      {step === 'liste' && !mfaActive && (
        <div style={{
          backgroundColor: '#eff6ff', border: '1px solid #bfdbfe',
          borderRadius: '12px', padding: '16px',
        }}>
          <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#1e40af', marginTop: 0, marginBottom: '8px' }}>
            Pourquoi activer la 2FA ?
          </h3>
          <ul style={{ fontSize: '13px', color: '#1d4ed8', paddingLeft: '20px', margin: 0, lineHeight: '1.8' }}>
            <li>Protège votre compte même si votre mot de passe est compromis</li>
            <li>Un code unique est requis à chaque connexion</li>
            <li>Compatible avec Google Authenticator, Authy, et autres</li>
          </ul>
        </div>
      )}
    </div>
  )
}
