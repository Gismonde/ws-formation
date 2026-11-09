import { Suspense } from 'react'
import BienvenueForm from './BienvenueForm'
import { i18n } from '@/lib/i18n/serveur'
import { ChoixLangue } from '@/components/ChoixLangue'
import StylesConnexion, { EnteteConnexion } from '@/components/StylesConnexion'

export const metadata = { title: 'Bienvenue — WS Formation' }

export default async function BienvenuePage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { t } = await i18n()
  const reinit = (await searchParams).type === 'recovery'
  return (
    <>
      <StylesConnexion />
      <div className="fond-connexion">
        <div className="carte-connexion">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}><ChoixLangue /></div>
          <EnteteConnexion titre={reinit ? t('Choisissez votre nouveau mot de passe') : t('Bienvenue sur WS Formation')}
            sousTitre={reinit ? t('Il remplacera votre mot de passe actuel.') : t('Choisissez votre mot de passe pour activer votre compte.')} />
          <Suspense fallback={null}>
            <BienvenueForm />
          </Suspense>
        </div>
      </div>
    </>
  )
}
