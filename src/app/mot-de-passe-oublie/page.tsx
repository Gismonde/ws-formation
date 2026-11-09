import { i18n } from '@/lib/i18n/serveur'
import { ChoixLangue } from '@/components/ChoixLangue'
import StylesConnexion, { EnteteConnexion } from '@/components/StylesConnexion'
import FormulaireOubli from './FormulaireOubli'

export const metadata = { title: 'Mot de passe oublié — WS Formation' }

export default async function MotDePasseOubliePage() {
  const { t } = await i18n()
  return (
    <>
      <StylesConnexion />
      <div className="fond-connexion">
        <div className="carte-connexion">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}><ChoixLangue /></div>
          <EnteteConnexion titre={t('Mot de passe oublié ?')} sousTitre={t('Entrez votre courriel : nous vous enverrons un lien pour choisir un nouveau mot de passe.')} />
          <FormulaireOubli />
        </div>
      </div>
    </>
  )
}
