'use client'
// Fenêtres de confirmation de l'application (remplacent window.confirm / alert).
// const confirmer = useConfirmer(); if (!(await confirmer({ message, danger: true }))) return
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useT } from '@/lib/i18n/client'

export type OptionsConfirmation = {
  message: string
  titre?: string
  /** Libellé du bouton de confirmation (par défaut « Confirmer ») */
  bouton?: string
  /** Action destructive : bouton rouge */
  danger?: boolean
  /** Simple information : un seul bouton « OK » */
  information?: boolean
}

type Demande = OptionsConfirmation & { resoudre: (ok: boolean) => void }
const Contexte = createContext<((o: OptionsConfirmation) => Promise<boolean>) | null>(null)

export function FournisseurConfirmation({ children }: { children: React.ReactNode }) {
  const { t } = useT()
  const [demande, setDemande] = useState<Demande | null>(null)
  const bouton = useRef<HTMLButtonElement>(null)

  const confirmer = useCallback((o: OptionsConfirmation) => new Promise<boolean>(resoudre => setDemande({ ...o, resoudre })), [])
  const fermer = useCallback((ok: boolean) => { setDemande(d => { d?.resoudre(ok); return null }) }, [])

  useEffect(() => {
    if (!demande) return
    bouton.current?.focus()
    const touche = (e: KeyboardEvent) => { if (e.key === 'Escape') fermer(false) }
    window.addEventListener('keydown', touche)
    return () => window.removeEventListener('keydown', touche)
  }, [demande, fermer])

  return (
    <Contexte.Provider value={confirmer}>
      {children}
      {demande && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={() => fermer(false)}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="confirmation-titre" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 id="confirmation-titre" className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
              {demande.danger && <span aria-hidden className="text-red-600">⚠</span>}
              {demande.titre ?? (demande.information ? t('Information') : t('Confirmation'))}
            </h2>
            <p className="text-sm text-gray-600 whitespace-pre-line">{demande.message}</p>
            <div className="mt-6 flex justify-end gap-2">
              {!demande.information && (
                <button type="button" onClick={() => fermer(false)} className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">{t('Annuler')}</button>
              )}
              <button ref={bouton} type="button" onClick={() => fermer(true)}
                className={'text-sm font-semibold px-4 py-2 rounded-lg text-white ' + (demande.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700')}>
                {demande.bouton ?? (demande.information ? t('OK') : t('Confirmer'))}
              </button>
            </div>
          </div>
        </div>
      )}
    </Contexte.Provider>
  )
}

/** Renvoie une fonction qui ouvre la fenêtre de confirmation et résout à true / false. */
export function useConfirmer() {
  const c = useContext(Contexte)
  // Repli si le fournisseur est absent (ne devrait pas arriver)
  return c ?? (async (o: OptionsConfirmation) => (o.information ? (window.alert(o.message), true) : window.confirm(o.message)))
}
