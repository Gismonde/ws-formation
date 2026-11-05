'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { useT } from '@/lib/i18n/client'
import type { Traducteur } from '@/lib/i18n/base'

const MIN = 10
function regle(pwd: string, t: Traducteur): string | null {
  if (pwd.length < MIN) return t('Le mot de passe doit contenir au moins {n} caractères.', { n: MIN })
  if (!/[A-Z]/.test(pwd)) return t('Le mot de passe doit contenir au moins une lettre majuscule.')
  if (!/[a-z]/.test(pwd)) return t('Le mot de passe doit contenir au moins une lettre minuscule.')
  if (!/[0-9]/.test(pwd)) return t('Le mot de passe doit contenir au moins un chiffre.')
  return null
}

const input: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box' }
const label: React.CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }

export default function BienvenueForm() {
  const params = useSearchParams()
  const tokenHash = params.get('token_hash')
  // Lien d'invitation du portail (nouveaux employés) : sans expiration, consommé à l'envoi du formulaire
  const invitation = params.get('invitation')
  const [etatInvitation, setEtatInvitation] = useState<{ valide: boolean; email?: string; error?: string } | null>(null)
  const type = params.get('type') === 'recovery' ? 'recovery' : 'invite'
  const [mdp, setMdp] = useState('')
  const [conf, setConf] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const { t } = useT()

  useEffect(() => {
    if (!invitation) return
    fetch('/api/auth/invitation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jeton: invitation, verifier: true }) })
      .then(r => r.json()).then(setEtatInvitation).catch(() => setEtatInvitation({ valide: false, error: t('Erreur de connexion. Réessayez dans un instant.') }))
  }, [invitation, t])

  if (invitation) {
    if (!etatInvitation) return <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>…</p>
    if (!etatInvitation.valide) return (
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#dc2626', fontSize: '14px' }}>{t(etatInvitation.error ?? 'Lien invalide.')}</p>
        <a href="/login" style={{ display: 'inline-block', marginTop: '8px', color: '#1e40af', fontSize: '14px', fontWeight: 600 }}>{t('Aller à la connexion →')}</a>
      </div>
    )
  } else if (!tokenHash) {
    return <p style={{ color: '#dc2626', fontSize: '14px', textAlign: 'center' }}>{t('Lien invalide. Demandez à votre gestionnaire de vous renvoyer l’invitation.')}</p>
  }

  async function soumettre(e: React.FormEvent) {
    e.preventDefault()
    setErreur(null)
    const r = regle(mdp, t)
    if (r) return setErreur(r)
    if (mdp !== conf) return setErreur(t('Les deux mots de passe ne correspondent pas.'))
    setEnCours(true)
    if (invitation) {
      try {
        const r2 = await fetch('/api/auth/invitation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jeton: invitation, motDePasse: mdp }) })
        const d = await r2.json().catch(() => ({}))
        if (!r2.ok) { setErreur(t(d.error ?? 'Erreur')); return }
        window.location.href = '/login?bienvenue=1'
      } catch {
        setErreur(t('Erreur de connexion. Réessayez dans un instant.'))
      } finally { setEnCours(false) }
      return
    }
    try {
      // Client isolé : le lien n'est consommé qu'au moment de l'envoi du formulaire
      // (les antivirus de messagerie qui « ouvrent » les liens ne peuvent pas l'invalider).
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
      const { error: errVerif } = await sb.auth.verifyOtp({ token_hash: tokenHash!, type })
      if (errVerif) {
        setErreur(t('Ce lien a expiré ou a déjà été utilisé. Demandez à votre gestionnaire de vous renvoyer l’invitation.'))
        return
      }
      const { error: errMaj } = await sb.auth.updateUser({ password: mdp })
      if (errMaj) {
        setErreur(/weak|pwned|leaked/i.test(errMaj.message)
          ? t('Ce mot de passe est trop courant. Choisissez-en un autre.')
          : t('Impossible d’enregistrer le mot de passe : {detail}', { detail: errMaj.message }))
        return
      }
      // Compte activé : les courriels « formation assignée » retenus jusque-là sont envoyés maintenant
      try {
        const { data: { session } } = await sb.auth.getSession()
        if (session?.access_token) await fetch('/api/auth/activation', { method: 'POST', headers: { Authorization: 'Bearer ' + session.access_token } })
      } catch { /* sans gravité : la personne voit ses formations en se connectant */ }
      await sb.auth.signOut({ scope: 'local' })
      window.location.href = '/login?bienvenue=1'
    } finally {
      setEnCours(false)
    }
  }

  return (
    <form onSubmit={soumettre}>
      {etatInvitation?.email && <p style={{ textAlign: 'center', fontSize: '13px', color: '#374151', margin: '0 0 14px' }}>{t('Votre identifiant : {email}', { email: etatInvitation.email })}</p>}
      <div style={{ marginBottom: '14px' }}>
        <label style={label}>{t('Nouveau mot de passe')}</label>
        <input type="password" style={input} value={mdp} onChange={e => setMdp(e.target.value)} autoComplete="new-password" required />
        <p style={{ fontSize: '12px', color: '#6b7280', margin: '6px 0 0' }}>{t('Au moins {n} caractères, avec une majuscule, une minuscule et un chiffre.', { n: MIN })}</p>
      </div>
      <div style={{ marginBottom: '16px' }}>
        <label style={label}>{t('Confirmer le mot de passe')}</label>
        <input type="password" style={input} value={conf} onChange={e => setConf(e.target.value)} autoComplete="new-password" required />
      </div>
      {erreur && (
        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 12px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' }}>{erreur}</div>
      )}
      <button type="submit" disabled={enCours}
        style={{ width: '100%', padding: '12px', backgroundColor: '#1e40af', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', opacity: enCours ? 0.6 : 1 }}>
        {enCours ? t('Enregistrement…') : t('Activer mon compte')}
      </button>
    </form>
  )
}
