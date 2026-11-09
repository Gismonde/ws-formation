'use client'
import { useState } from 'react'
import { useT } from '@/lib/i18n/client'
import { CHAMP_CONNEXION } from '@/components/StylesConnexion'


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

  const retour = <a href="/login" className="lien-connexion" style={{ display: 'block', textAlign: 'center', marginTop: '18px' }}>{t('← Retour à la connexion')}</a>
  const aide = <p style={{ fontSize: '13px', color: '#5b5675', margin: '14px 0 0', textAlign: 'center' }}>{t('Pas de courriel ? Vérifiez vos courriels indésirables ou demandez à votre gestionnaire.')}</p>

  if (etat === 'fait') return (
    <div>
      <div role="status" style={{ backgroundColor: 'rgba(240,253,244,0.9)', border: '1px solid #bbf7d0', color: '#15803d', padding: '12px 14px', borderRadius: '14px', fontSize: '14px' }}>
        {t('Si un compte actif existe pour cette adresse, un courriel vient de vous être envoyé avec un lien pour choisir un nouveau mot de passe. Ce lien expire rapidement.')}
      </div>
      {aide}{retour}
    </div>
  )

  return (
    <form onSubmit={envoyer}>
      <input id="courriel-oubli" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} aria-label={t('Courriel')} className="champ-connexion" style={CHAMP_CONNEXION} placeholder={t('Adresse courriel')} />
      {etat === 'erreur' && <p style={{ color: '#dc2626', fontSize: '14px', margin: '12px 0 0' }}>{t('Erreur de connexion. Réessayez dans un instant.')}</p>}
      <button type="submit" disabled={etat === 'envoi' || !email} className="bouton-connexion" style={{ marginTop: '18px', opacity: etat === 'envoi' ? 0.6 : 1 }}>
        {etat === 'envoi' ? t('Envoi…') : t('Recevoir le lien')}
      </button>
      {aide}{retour}
    </form>
  )
}
