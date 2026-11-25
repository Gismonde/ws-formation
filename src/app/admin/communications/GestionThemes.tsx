'use client'
// Catégories générales des guides et consentements (Recherche, Nutrition, Chirurgie…) : ajouter, renommer, retirer.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n/client'
import { useConfirmer } from '@/components/Confirmation'
import type { Theme } from '@/lib/communications'

const champ = 'rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

export default function GestionThemes({ themes }: { themes: Theme[] }) {
  const { t } = useT()
  const router = useRouter()
  const confirmer = useConfirmer()
  const [nouveau, setNouveau] = useState('')
  const [edition, setEdition] = useState<{ id: string; nom: string } | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  async function appel(url: string, method: string, corps?: object) {
    setEnvoi(true); setErreur(null)
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: corps ? JSON.stringify(corps) : undefined })
    const d = await r.json().catch(() => ({}))
    setEnvoi(false)
    if (!r.ok) { setErreur(d.error ?? t('Erreur')); return false }
    router.refresh()
    return true
  }

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="font-semibold text-gray-900">{t('Catégories des guides et consentements')}</h2>
      <p className="text-sm text-gray-500 mt-1 mb-4">{t('Les employés voient les guides et consentements regroupés par catégorie. Une catégorie sert aux deux pages.')}</p>
      {erreur && <p className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2 mb-3">{erreur}</p>}
      <div className="flex flex-wrap gap-2 mb-4">
        {themes.length === 0 && <span className="text-sm text-gray-400">{t('Aucune catégorie pour le moment.')}</span>}
        {themes.map(th => edition?.id === th.id ? (
          <span key={th.id} className="flex items-center gap-1">
            <input className={champ} value={edition.nom} maxLength={80} autoFocus onChange={e => setEdition({ ...edition, nom: e.target.value })}
              onKeyDown={async e => { if (e.key === 'Enter' && await appel(`/api/admin/themes-documents/${th.id}`, 'PATCH', { nom: edition.nom })) setEdition(null); if (e.key === 'Escape') setEdition(null) }} />
            <button type="button" disabled={envoi} onClick={async () => { if (await appel(`/api/admin/themes-documents/${th.id}`, 'PATCH', { nom: edition.nom })) setEdition(null) }} className="text-sm font-semibold text-indigo-700 px-2">{t('Enregistrer')}</button>
            <button type="button" onClick={() => setEdition(null)} className="text-sm text-gray-500 px-1">{t('Annuler')}</button>
          </span>
        ) : (
          <span key={th.id} className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 pl-3 pr-1 py-1 text-sm text-gray-800">
            {th.nom}
            <button type="button" title={t('Renommer')} onClick={() => setEdition({ id: th.id, nom: th.nom })} className="text-xs text-indigo-700 hover:underline px-1">{t('Renommer')}</button>
            <button type="button" title={t('Retirer')} disabled={envoi} onClick={async () => {
              if (await confirmer({ message: t('Retirer la catégorie « {nom} » ? Les documents qui y sont classés restent publiés, sans catégorie.', { nom: th.nom }), bouton: t('Retirer') }))
                await appel(`/api/admin/themes-documents/${th.id}`, 'DELETE')
            }} className="text-xs text-red-600 hover:underline px-1">✕</button>
          </span>
        ))}
      </div>
      <form className="flex flex-wrap gap-2" onSubmit={async e => { e.preventDefault(); if (nouveau.trim() && await appel('/api/admin/themes-documents', 'POST', { nom: nouveau })) setNouveau('') }}>
        <input className={champ + ' flex-1 min-w-[200px]'} placeholder={t('Nouvelle catégorie (ex. Nutrition)')} value={nouveau} maxLength={80} onChange={e => setNouveau(e.target.value)} />
        <button type="submit" disabled={envoi || !nouveau.trim()} className="text-sm font-semibold px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">+ {t('Ajouter')}</button>
      </form>
    </section>
  )
}
