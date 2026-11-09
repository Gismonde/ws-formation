import { i18n } from '@/lib/i18n/serveur'
import { ChoixLangue } from '@/components/ChoixLangue'
import FormulaireOubli from './FormulaireOubli'

export const metadata = { title: 'Mot de passe oublié — WS Formation' }

export default async function MotDePasseOubliePage() {
  const { t } = await i18n()
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f4ff', fontFamily: 'sans-serif', padding: '16px' }}>
      <div style={{ backgroundColor: 'white', padding: 'clamp(24px, 6vw, 40px)', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}><ChoixLangue /></div>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ margin: '0 0 6px', fontSize: '22px', color: '#1e40af' }}>{t('Mot de passe oublié ?')}</h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>{t('Entrez votre courriel : nous vous enverrons un lien pour choisir un nouveau mot de passe.')}</p>
        </div>
        <FormulaireOubli />
      </div>
    </div>
  )
}
