'use client'
import { useState } from 'react'
import { useT } from '@/lib/i18n/client'

const input: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '16px', boxSizing: 'border-box' }

export default function FormulaireOubli() {
  const { t } = useT()
  const [email, setEmail] = useState('')
  const [etat, setEtat] = useState<'repos' | 'envoi' | 'fait' | 'erreur'>('repos')

  async function envoyer(e: React.FormEvent) {
    e.preventDefault()
    setEtat('envoi')
    try {
      const r = await fetch('/api/auth/mot-de-passe-oublie', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      setEtat(r.ok ? 'fait' : 'erreur')
    } catch { setEtat('erreur') }
  }

  const retour = <a href="/login" style={{ display: 'block', textAlign: 'center', marginTop: '18px', color: '#1e40af', fontSize: '14px', fontWeight: 600 }}>{t('← Retour à la connexion')}</a>
  const aide = <p style={{ fontSize: '13px', color: '#6b7280', margin: '14px 0 0' }}>{t('Pas de courriel ? Vérifiez vos courriels indésirables ou demandez à votre gestionnaire.')}</p>

  if (etat === 'fait') return (
    <div>
      <div role="status" style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', padding: '12px', borderRadius: '6px', fontSize: '14px' }}>
        {t('Si un compte actif existe pour cette adresse, un courriel vient de vous être envoyé avec un lien pour choisir un nouveau mot de passe. Ce lien expire rapidement.')}
      </div>
      {aide}{retour}
    </div>
  )

  return (
    <form onSubmit={envoyer}>
      <label htmlFor="courriel-oubli" style={{ display: 'block', marginBottom: '6px', fontWeight: 500, color: '#374151' }}>{t('Courriel')}</label>
      <input id="courriel-oubli" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} style={input} placeholder={t('votre@courriel.com')} />
      {etat === 'erreur' && <p style={{ color: '#dc2626', fontSize: '14px', margin: '12px 0 0' }}>{t('Erreur de connexion. Réessayez dans un instant.')}</p>}
      <button type="submit" disabled={etat === 'envoi' || !email}
        style={{ width: '100%', marginTop: '18px', padding: '12px', backgroundColor: '#1e40af', color: 'white', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 600, cursor: 'pointer', opacity: etat === 'envoi' ? 0.6 : 1 }}>
        {etat === 'envoi' ? t('Envoi…') : t('Recevoir le lien')}
      </button>
      {aide}{retour}
    </form>
  )
}
