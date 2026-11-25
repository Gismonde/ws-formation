'use client'
// Catégories des guides et consentements, sur plusieurs niveaux
// (ex. Chirurgie › Chirurgie générale › Dre Doyon) : ajouter, ajouter une sous-catégorie, renommer, retirer.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n/client'
import { useConfirmer } from '@/components/Confirmation'
import { themesEnArbre, type Theme } from '@/lib/communications'

const champ = 'rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

export default function GestionThemes({ themes }: { themes: Theme[] }) {
  const { t } = useT()
  const router = useRouter()
  const confirmer = useConfirmer()
  const [nouveau, setNouveau] = useState('')
  const [ajoutSous, setAjoutSous] = useState<{ parent: string; nom: string } | null>(null)
  const [edition, setEdition] = useState<{ id: string; nom: string } | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const arbre = themesEnArbre(themes)
  const aDesEnfants = (id: string) => themes.some(x => x.parent_id === id)

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
      <p className="text-sm text-gray-500 mt-1 mb-4">{t('Les employés voient les guides et consentements regroupés par catégorie et sous-catégorie. Une catégorie sert aux deux pages.')}</p>
      {erreur && <p className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2 mb-3">{erreur}</p>}
      <div className="grid gap-1 mb-4">
        {arbre.length === 0 && <span className="text-sm text-gray-400">{t('Aucune catégorie pour le moment.')}</span>}
        {arbre.map(th => (
          <div key={th.id}>
            <div className="flex flex-wrap items-center gap-2 py-1" style={{ paddingLeft: th.niveau * 22 }}>
              {edition?.id === th.id ? (
                <>
                  <input className={champ} value={edition.nom} maxLength={80} autoFocus onChange={e => setEdition({ ...edition, nom: e.target.value })}
                    onKeyDown={async e => { if (e.key === 'Enter' && await appel(`/api/admin/themes-documents/${th.id}`, 'PATCH', { nom: edition.nom })) setEdition(null); if (e.key === 'Escape') setEdition(null) }} />
                  <button type="button" disabled={envoi} onClick={async () => { if (await appel(`/api/admin/themes-documents/${th.id}`, 'PATCH', { nom: edition.nom })) setEdition(null) }} className="text-sm font-semibold text-indigo-700">{t('Enregistrer')}</button>
                  <button type="button" onClick={() => setEdition(null)} className="text-sm text-gray-500">{t('Annuler')}</button>
                </>
              ) : (
                <>
                  <span className={'text-sm ' + (th.niveau === 0 ? 'font-semibold text-gray-900' : 'text-gray-800')}>{th.niveau > 0 ? '↳ ' : ''}{th.nom}</span>
                  <button type="button" onClick={() => setAjoutSous({ parent: th.id, nom: '' })} className="text-xs text-indigo-700 hover:underline">+ {t('Sous-catégorie')}</button>
                  <button type="button" onClick={() => setEdition({ id: th.id, nom: th.nom })} className="text-xs text-gray-600 hover:underline">{t('Renommer')}</button>
                  {!aDesEnfants(th.id) && (
                    <button type="button" disabled={envoi} onClick={async () => {
                      if (await confirmer({ message: t('Retirer la catégorie « {nom} » ? Les documents qui y sont classés restent publiés, sans catégorie.', { nom: th.nom }), bouton: t('Retirer') }))
                        await appel(`/api/admin/themes-documents/${th.id}`, 'DELETE')
                    }} className="text-xs text-red-600 hover:underline">{t('Retirer')}</button>
                  )}
                </>
              )}
            </div>
            {ajoutSous?.parent === th.id && (
              <form className="flex flex-wrap gap-2 py-1" style={{ paddingLeft: (th.niveau + 1) * 22 }}
                onSubmit={async e => { e.preventDefault(); if (ajoutSous.nom.trim() && await appel('/api/admin/themes-documents', 'POST', { nom: ajoutSous.nom, parent_id: th.id })) setAjoutSous(null) }}>
                <input className={champ} autoFocus placeholder={t('Nom de la sous-catégorie')} value={ajoutSous.nom} maxLength={80} onChange={e => setAjoutSous({ ...ajoutSous, nom: e.target.value })} />
                <button type="submit" disabled={envoi || !ajoutSous.nom.trim()} className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 text-white disabled:opacity-50">{t('Ajouter')}</button>
                <button type="button" onClick={() => setAjoutSous(null)} className="text-sm text-gray-500">{t('Annuler')}</button>
              </form>
            )}
          </div>
        ))}
      </div>
      <form className="flex flex-wrap gap-2" onSubmit={async e => { e.preventDefault(); if (nouveau.trim() && await appel('/api/admin/themes-documents', 'POST', { nom: nouveau })) setNouveau('') }}>
        <input className={champ + ' flex-1 min-w-[200px] py-2'} placeholder={t('Nouvelle catégorie (ex. Nutrition)')} value={nouveau} maxLength={80} onChange={e => setNouveau(e.target.value)} />
        <button type="submit" disabled={envoi || !nouveau.trim()} className="text-sm font-semibold px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">+ {t('Ajouter')}</button>
      </form>
    </section>
  )
}
