'use client'
// Copie de travail : sur une formation publiée (créer / ouvrir la copie) ou sur la copie elle-même (appliquer / abandonner).
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n/client'

async function appeler(url: string, method: string, corps?: unknown) {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: corps ? JSON.stringify(corps) : undefined })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'Erreur')
  return d
}

/** Sur la formation publiée */
export function CarteCopieTravail({ formationId, copie }: { formationId: string; copie: { id: string; statut: string } | null }) {
  const { t } = useT()
  const router = useRouter()
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const creer = async () => {
    setEnvoi(true); setErreur(null)
    try {
      const d = await appeler(`/api/admin/formations/${formationId}/copie-travail`, 'POST')
      router.push(`/admin/formations/${d.id}/editeur`)
    } catch (e) { setErreur(e instanceof Error ? e.message : t('Erreur')); setEnvoi(false) }
  }

  const libelle: Record<string, string> = {
    brouillon: t('en cours de modification'), en_validation: t('en attente de validation'),
    a_modifier: t('modifications demandées'), approuvee: t('approuvée — prête à appliquer'),
  }
  return (
    <div className="bg-violet-50 border border-violet-200 rounded-2xl p-5 mb-6 flex flex-wrap items-center gap-4">
      <div className="flex-1 min-w-[240px]">
        <p className="font-semibold text-violet-900">✏️ {copie ? t('Une copie de travail est en cours') : t('Modifier sans que les employés voient les changements')}</p>
        <p className="text-sm text-violet-800 mt-0.5">
          {copie
            ? t('Statut de la copie : {s}. Les employés voient toujours la version publiée.', { s: libelle[copie.statut] ?? libelle.brouillon })
            : t('Travaillez sur une copie de la formation, faites-la valider, puis appliquez-la d’un coup. La progression des employés est conservée.')}
        </p>
        {erreur && <p className="text-sm text-red-600 mt-1">{erreur}</p>}
      </div>
      {copie ? (
        <div className="flex gap-2">
          <Link href={`/admin/formations/${copie.id}`} className="text-sm font-semibold px-4 py-2 rounded-lg bg-white border border-violet-300 text-violet-800 hover:bg-violet-100">{t('Fiche de la copie')}</Link>
          <Link href={`/admin/formations/${copie.id}/editeur`} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700">{t('Ouvrir la copie de travail')}</Link>
        </div>
      ) : (
        <button type="button" onClick={creer} disabled={envoi} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50">
          {envoi ? t('Copie en cours…') : t('Créer une copie de travail')}
        </button>
      )}
    </div>
  )
}

/** Sur la copie de travail */
export function BandeauCopie({ copieId, original, approuvee }: { copieId: string; original: { id: string; titre: string; version: number | null }; approuvee: boolean }) {
  const { t } = useT()
  const router = useRouter()
  const [dialogue, setDialogue] = useState<null | 'appliquer' | 'abandonner'>(null)
  const [note, setNote] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const agir = async () => {
    setEnvoi(true); setErreur(null)
    try {
      if (dialogue === 'appliquer') await appeler(`/api/admin/formations/${copieId}/copie-travail`, 'PUT', { note })
      else await appeler(`/api/admin/formations/${copieId}/copie-travail`, 'DELETE')
      router.push(`/admin/formations/${original.id}`)
      router.refresh()
    } catch (e) { setErreur(e instanceof Error ? e.message : t('Erreur')); setEnvoi(false) }
  }

  return (
    <div className="bg-violet-600 text-white rounded-2xl p-5 mb-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[240px]">
          <p className="font-bold">✏️ {t('Copie de travail')}</p>
          <p className="text-sm text-violet-100 mt-0.5">
            {t('Copie de « {titre} ». Les employés ne voient pas ces changements tant que la copie n’est pas approuvée puis appliquée.', { titre: original.titre })}{' '}
            <Link href={`/admin/formations/${original.id}`} className="underline font-semibold text-white">{t('Voir la version publiée')}</Link>
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => { setDialogue('abandonner'); setErreur(null) }} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-400">{t('Abandonner la copie')}</button>
          <button type="button" onClick={() => { setDialogue('appliquer'); setErreur(null) }} disabled={!approuvee}
            title={approuvee ? undefined : t('La copie doit d’abord être approuvée par un validateur')}
            className="text-sm font-semibold px-4 py-2 rounded-lg bg-white text-violet-700 hover:bg-violet-50 disabled:opacity-50 disabled:cursor-not-allowed">
            {t('Appliquer à la formation publiée')}
          </button>
        </div>
      </div>
      {!approuvee && <p className="text-xs text-violet-100 mt-3">{t('Étapes : 1. modifiez la copie · 2. envoyez-la en validation (panneau ci-dessous) · 3. une fois approuvée, appliquez-la.')}</p>}

      {dialogue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 text-gray-900" onClick={() => !envoi && setDialogue(null)}>
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            {dialogue === 'appliquer' ? (
              <>
                <h2 className="text-lg font-bold mb-1">{original.version ? t('Publier la version {n}', { n: original.version + 1 }) : t('Appliquer la copie')}</h2>
                <p className="text-sm text-gray-500 mb-4">{t('Le contenu et les réglages de la formation publiée seront remplacés par ceux de la copie. La progression des employés est conservée pour les leçons qui existent toujours ; les tentatives au questionnaire sont conservées.')}</p>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Ce qui a changé *')}</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} maxLength={1000} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
                  placeholder={t('Ex. : nouvelle politique de confidentialité 2026, vidéo remplacée, 2 questions ajoutées')} />
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold mb-1">{t('Abandonner la copie de travail ?')}</h2>
                <p className="text-sm text-gray-500 mb-4">{t('Les modifications faites dans la copie seront perdues. La formation publiée reste inchangée.')}</p>
              </>
            )}
            {erreur && <p className="text-sm text-red-600 mb-3">{erreur}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDialogue(null)} disabled={envoi} className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-700">{t('Annuler')}</button>
              <button type="button" onClick={agir} disabled={envoi || (dialogue === 'appliquer' && !note.trim())}
                className={'text-sm font-semibold px-4 py-2 rounded-lg text-white disabled:opacity-50 ' + (dialogue === 'appliquer' ? 'bg-violet-600' : 'bg-red-600')}>
                {envoi ? t('Un instant…') : dialogue === 'appliquer' ? t('Appliquer') : t('Abandonner la copie')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
