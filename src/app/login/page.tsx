import PrivacyBanner from './PrivacyBanner'
import { i18n } from '@/lib/i18n/serveur'
import { ChoixLangue } from '@/components/ChoixLangue'
import ChampsConnexion from './ChampsConnexion'
import StylesConnexion from '@/components/StylesConnexion'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: any
}) {
  const { t } = await i18n()
  const errorMsg = searchParams?.error === 'archived'
    ? t('Votre compte a été désactivé. Contactez votre administrateur.')
    : searchParams?.error
    ? t('Courriel ou mot de passe incorrect')
    : null

  return (
    <>
      <PrivacyBanner />
      <StylesConnexion />
      <div className="fond-connexion">
        <div className="carte-connexion">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}><ChoixLangue /></div>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logos/ws-formation-v2.webp" alt="WS Formation" width={117} height={120} className="logo-connexion" style={{ height: '120px', width: 'auto' }} />
            </div>
            <h1 style={{ margin: '0 0 6px', fontSize: '32px', fontWeight: 800, color: '#1b1640', letterSpacing: '-0.01em' }}>{t('Connexion')}</h1>
            <p style={{ margin: 0, color: '#5b5675', fontSize: '16px' }}>{t('Accédez à votre espace de formation')}</p>
          </div>

          <form method="POST" action="/api/auth/login">
            <ChampsConnexion />

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
              <a href="/mot-de-passe-oublie" className="lien-connexion">{t('Mot de passe oublié ?')}</a>
            </div>

            {searchParams?.bienvenue && !errorMsg && (
              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', padding: '10px 12px', borderRadius: '12px', marginBottom: '16px', fontSize: '14px' }}>
                {t('Votre mot de passe est enregistré. Connectez-vous pour accéder à votre portail.')}
              </div>
            )}

            {errorMsg && (
              <div role="alert" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 12px', borderRadius: '12px', marginBottom: '16px', fontSize: '14px' }}>
                {errorMsg}
              </div>
            )}

            <button type="submit" className="bouton-connexion">{t('Se connecter')}</button>
          </form>
        </div>
      </div>
    </>
  )
}
