'use client'

import { useState } from 'react'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/i18n/client'
import type { Traducteur } from '@/lib/i18n/base'

const MIN_LENGTH = 10

function validerMotDePasse(pwd: string, t: Traducteur): string | null {
  if (pwd.length < MIN_LENGTH) return t('Le mot de passe doit contenir au moins {n} caractères.', { n: MIN_LENGTH })
  if (!/[A-Z]/.test(pwd)) return t('Le mot de passe doit contenir au moins une lettre majuscule.')
  if (!/[a-z]/.test(pwd)) return t('Le mot de passe doit contenir au moins une lettre minuscule.')
  if (!/[0-9]/.test(pwd)) return t('Le mot de passe doit contenir au moins un chiffre.')
  return null
}

// Vérifie le mot de passe actuel avec un client isolé (sans persistance),
// pour ne pas écraser la session courante (ni son niveau 2FA).
async function verifierMotDePasseActuel(email: string, password: string): Promise<boolean> {
  const verif = createSupabaseJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  )
  const { error } = await verif.auth.signInWithPassword({ email, password })
  if (error) return false
  await verif.auth.signOut({ scope: 'local' })
  return true
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: '8px',
  border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px',
}

export default function ChangePasswordForm() {
  const supabase = createClient()
  const { t } = useT()
  const [actuel, setActuel] = useState('')
  const [nouveau, setNouveau] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function soumettre(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)

    const regle = validerMotDePasse(nouveau, t)
    if (regle) return setMessage({ type: 'error', text: regle })
    if (nouveau !== confirmation) return setMessage({ type: 'error', text: t('Les deux nouveaux mots de passe ne correspondent pas.') })
    if (nouveau === actuel) return setMessage({ type: 'error', text: t('Le nouveau mot de passe doit être différent de l’actuel.') })

    setEnCours(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) {
        setMessage({ type: 'error', text: t('Session expirée. Veuillez vous reconnecter.') })
        return
      }

      const ok = await verifierMotDePasseActuel(user.email, actuel)
      if (!ok) {
        setMessage({ type: 'error', text: t('Mot de passe actuel incorrect.') })
        return
      }

      const { error } = await supabase.auth.updateUser({ password: nouveau })
      if (error) {
        setMessage({ type: 'error', text: t('Erreur lors de la modification : {detail}', { detail: error.message }) })
        return
      }

      setMessage({ type: 'success', text: t('Mot de passe modifié avec succès.') })
      setActuel('')
      setNouveau('')
      setConfirmation('')
    } finally {
      setEnCours(false)
    }
  }

  const pret = actuel.length > 0 && nouveau.length > 0 && confirmation.length > 0 && !enCours

  return (
    <div style={{
      backgroundColor: 'white', border: '1px solid #e5e7eb',
      borderRadius: '12px', padding: '24px', marginBottom: '24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '8px', backgroundColor: '#f9fafb',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px',
        }}>
          🔑
        </div>
        <div>
          <div style={{ fontWeight: '600', color: '#1a1f36', fontSize: '15px' }}>{t('Mot de passe')}</div>
          <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>
            {t('Au moins {n} caractères, avec une majuscule, une minuscule et un chiffre.', { n: MIN_LENGTH })}
          </div>
        </div>
      </div>

      {message && (
        <div style={{
          padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px',
          backgroundColor: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: message.type === 'success' ? '1px solid #bbf7d0' : '1px solid #fecaca',
          color: message.type === 'success' ? '#166534' : '#991b1b',
        }}>
          {message.text}
        </div>
      )}

      <form onSubmit={soumettre}>
        <div style={{ marginBottom: '14px' }}>
          <label htmlFor="pwd-actuel" style={labelStyle}>{t('Mot de passe actuel')}</label>
          <input id="pwd-actuel" type="password" autoComplete="current-password"
            value={actuel} onChange={e => setActuel(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ marginBottom: '14px' }}>
          <label htmlFor="pwd-nouveau" style={labelStyle}>{t('Nouveau mot de passe')}</label>
          <input id="pwd-nouveau" type="password" autoComplete="new-password"
            value={nouveau} onChange={e => setNouveau(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ marginBottom: '18px' }}>
          <label htmlFor="pwd-confirmation" style={labelStyle}>{t('Confirmer le nouveau mot de passe')}</label>
          <input id="pwd-confirmation" type="password" autoComplete="new-password"
            value={confirmation} onChange={e => setConfirmation(e.target.value)} style={inputStyle} />
        </div>
        <button type="submit" disabled={!pret} style={{
          width: '100%', padding: '10px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: '600',
          backgroundColor: pret ? '#4f46e5' : '#e5e7eb', color: pret ? 'white' : '#9ca3af',
          border: 'none', cursor: pret ? 'pointer' : 'not-allowed',
        }}>
          {enCours ? t('Modification…') : t('Changer le mot de passe')}
        </button>
      </form>
    </div>
  )
}
