'use client'
import { useState } from 'react'
import { useT } from '@/lib/i18n/client'

export default function CadreApercu({ formationId, titre, retour }: { formationId: string; titre: string; retour: 'fiche' | 'editeur' }) {
  const { t } = useT()
  const [appareil, setAppareil] = useState<'ordinateur' | 'telephone'>('ordinateur')
  const [cle, setCle] = useState(0)
  const bouton = (actif: boolean) => 'px-3 py-1.5 rounded-md text-sm font-medium ' + (actif ? 'bg-white text-gray-900 shadow-sm' : 'text-white/80 hover:text-white')

  async function recommencer() {
    await fetch('/api/apercu/progression', { method: 'DELETE' })
    setCle(k => k + 1)
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-gray-800">
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-amber-500 text-white">
        <span className="font-semibold">👁 {t('Mode employé — rien n’est enregistré')}</span>
        <span className="text-sm text-white/90 truncate max-w-[40ch]">{titre}</span>
        <div className="flex gap-1 bg-black/20 rounded-lg p-1 ml-auto">
          <button type="button" className={bouton(appareil === 'ordinateur')} onClick={() => setAppareil('ordinateur')}>💻 {t('Ordinateur')}</button>
          <button type="button" className={bouton(appareil === 'telephone')} onClick={() => setAppareil('telephone')}>📱 {t('Téléphone')}</button>
        </div>
        <button type="button" onClick={recommencer} className="text-sm px-3 py-1.5 rounded-md bg-black/20 hover:bg-black/30">↺ {t('Recommencer')}</button>
        <a href={`/api/admin/formations/${formationId}/mode-employe?sortir=1&retour=${retour}`} className="text-sm font-semibold px-3 py-1.5 rounded-md bg-white text-amber-700 hover:bg-amber-50">{retour === 'fiche' ? t('← Revenir à la formation') : t('← Revenir à l’éditeur')}</a>
      </div>
      <div className="flex-1 overflow-auto flex justify-center items-start p-4">
        <iframe
          key={cle}
          src={`/formations/${formationId}`}
          title={t('Mode employé')}
          className={'bg-white shadow-2xl ' + (appareil === 'telephone' ? 'rounded-[2rem] border-[10px] border-gray-900' : 'rounded-lg')}
          style={appareil === 'telephone' ? { width: 390, height: 'min(844px, calc(100vh - 110px))' } : { width: '100%', height: 'calc(100vh - 90px)' }}
        />
      </div>
    </div>
  )
}
