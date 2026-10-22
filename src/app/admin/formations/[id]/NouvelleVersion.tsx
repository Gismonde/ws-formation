'use client'
// Publier une nouvelle version d'une formation déjà publiée (numéro de version, date de mise à jour, note).
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n/client'
import { publierNouvelleVersion } from '@/lib/actions/formations'

export default function NouvelleVersion({ formationId, version, approuvee = true }: { formationId: string; version: number; approuvee?: boolean }) {
  const { t } = useT()
  const router = useRouter()
  const [ouvert, setOuvert] = useState(false)
  const [note, setNote] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const publier = async () => {
    setEnvoi(true); setErreur(null)
    const r = await publierNouvelleVersion(formationId, note)
    setEnvoi(false)
    if (!r.success) { setErreur(r.error); return }
    setOuvert(false); setNote('')
    router.refresh()
  }

  return (
    <>
      <button type="button" onClick={() => setOuvert(true)} disabled={!approuvee} title={approuvee ? undefined : t('Envoyez d’abord les modifications en validation')} className="text-sm font-semibold px-4 py-2 rounded-lg bg-white border border-indigo-300 text-indigo-700 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed">
        {t('Nouvelle version (v{n})', { n: version + 1 })}
      </button>
      {ouvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOuvert(false)}>
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-1">{t('Publier la version {n}', { n: version + 1 })}</h2>
            <p className="text-sm text-gray-500 mb-4">{t('Indique que la formation a été mise à jour. La date de mise à jour et votre note sont conservées dans le journal des versions.')}</p>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Ce qui a changé *')}</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} maxLength={1000} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
              placeholder={t('Ex. : nouvelle politique de confidentialité 2026, vidéo remplacée, 2 questions ajoutées')} />
            {erreur && <p className="text-sm text-red-600 mb-3">{erreur}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOuvert(false)} className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-700">{t('Annuler')}</button>
              <button type="button" onClick={publier} disabled={envoi || !note.trim()} className="text-sm font-semibold px-4 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-50">{envoi ? t('Publication…') : t('Publier la version {n}', { n: version + 1 })}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
