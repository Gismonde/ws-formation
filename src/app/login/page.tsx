import PrivacyBanner from './PrivacyBanner'
import { i18n } from '@/lib/i18n/serveur'
import { ChoixLangue } from '@/components/ChoixLangue'
import ChampsConnexion from './ChampsConnexion'
import Symbole from './Symbole'

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
      <style>{`
        .fond-connexion { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px 16px; box-sizing: border-box; font-family: 'Inter', system-ui, sans-serif;
          background: #e9dcfa url('/fonds/connexion.webp') center / cover no-repeat; }
        @media (max-width: 700px) { .fond-connexion { background-image: url('/fonds/connexion-mobile.webp'); } }
        .carte-connexion { position: relative; z-index: 1; width: 100%; max-width: 440px; padding: clamp(26px, 6vw, 44px); border-radius: 28px; box-sizing: border-box;
          background: rgba(255,255,255,0.62); border: 1px solid rgba(255,255,255,0.9); box-shadow: 0 24px 60px rgba(91, 61, 160, 0.16); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); }
        .champ-connexion:focus { border-color: #8b5cf6 !important; box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.18); }
        .bouton-connexion { width: 100%; padding: 15px; border: none; border-radius: 999px; color: #fff; font-size: 17px; font-weight: 600; cursor: pointer;
          background: linear-gradient(90deg, #7c6cf2 0%, #a77ce8 50%, #e07ac8 100%); box-shadow: 0 10px 24px rgba(124, 92, 230, 0.28); transition: transform .15s, box-shadow .15s; }
        .bouton-connexion:hover { transform: translateY(-1px); box-shadow: 0 14px 28px rgba(124, 92, 230, 0.34); }
        .lien-connexion { color: #6d4fd8; font-size: 14px; font-weight: 600; text-decoration: none; }
        .lien-connexion:hover { text-decoration: underline; }
      `}</style>
      <div className="fond-connexion">
        <div className="carte-connexion">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}><ChoixLangue /></div>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}><Symbole /></div>
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
