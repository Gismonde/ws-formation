'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const MIN = 10
function regle(pwd: string): string | null {
  if (pwd.length < MIN) return `Le mot de passe doit contenir au moins ${MIN} caractères.`
  if (!/[A-Z]/.test(pwd)) return 'Le mot de passe doit contenir au moins une lettre majuscule.'
  if (!/[a-z]/.test(pwd)) return 'Le mot de passe doit contenir au moins une lettre minuscule.'
  if (!/[0-9]/.test(pwd)) return 'Le mot de passe doit contenir au moins un chiffre.'
  return null
}

const input: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box' }
const label: React.CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }

export default function BienvenueForm() {
  const params = useSearchParams()
  const tokenHash = params.get('token_hash')
  const type = params.get('type') === 'recovery' ? 'recovery' : 'invite'
  const [mdp, setMdp] = useState('')
  const [conf, setConf] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  if (!tokenHash) {
    return <p style={{ color: '#dc2626', fontSize: '14px', textAlign: 'center' }}>Lien invalide. Demandez à votre gestionnaire de vous renvoyer l’invitation.</p>
  }

  async function soumettre(e: React.FormEvent) {
    e.preventDefault()
    setErreur(null)
    const r = regle(mdp)
    if (r) return setErreur(r)
    if (mdp !== conf) return setErreur('Les deux mots de passe ne correspondent pas.')
    setEnCours(true)
    try {
      // Client isolé : le lien n'est consommé qu'au moment de l'envoi du formulaire
      // (les antivirus de messagerie qui « ouvrent » les liens ne peuvent pas l'invalider).
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
      const { error: errVerif } = await sb.auth.verifyOtp({ token_hash: tokenHash!, type })
      if (errVerif) {
        setErreur('Ce lien a expiré ou a déjà été utilisé. Demandez à votre gestionnaire de vous renvoyer l’invitation.')
        return
      }
      const { error: errMaj } = await sb.auth.updateUser({ password: mdp })
      if (errMaj) {
        setErreur(/weak|pwned|leaked/i.test(errMaj.message)
          ? 'Ce mot de passe est trop courant. Choisissez-en un autre.'
          : 'Impossible d’enregistrer le mot de passe : ' + errMaj.message)
        return
      }
      await sb.auth.signOut({ scope: 'local' })
      window.location.href = '/login?bienvenue=1'
    } finally {
      setEnCours(false)
    }
  }

  return (
    <form onSubmit={soumettre}>
      <div style={{ marginBottom: '14px' }}>
        <label style={label}>Nouveau mot de passe</label>
        <input type="password" style={input} value={mdp} onChange={e => setMdp(e.target.value)} autoComplete="new-password" required />
        <p style={{ fontSize: '12px', color: '#6b7280', margin: '6px 0 0' }}>Au moins 10 caractères, avec une majuscule, une minuscule et un chiffre.</p>
      </div>
      <div style={{ marginBottom: '16px' }}>
        <label style={label}>Confirmer le mot de passe</label>
        <input type="password" style={input} value={conf} onChange={e => setConf(e.target.value)} autoComplete="new-password" required />
      </div>
      {erreur && (
        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 12px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' }}>{erreur}</div>
      )}
      <button type="submit" disabled={enCours}
        style={{ width: '100%', padding: '12px', backgroundColor: '#1e40af', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', opacity: enCours ? 0.6 : 1 }}>
        {enCours ? 'Enregistrement…' : 'Activer mon compte'}
      </button>
    </form>
  )
}
