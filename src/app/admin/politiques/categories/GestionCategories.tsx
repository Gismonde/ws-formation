'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n/client'
import { useConfirmer } from '@/components/Confirmation'
import { FormCategorie } from '@/components/politiques/ChoixCategorie'
import type { CategoriePolitique } from '@/lib/politiques-categories'

export default function GestionCategories({ categories, departements, nombres }: { categories: CategoriePolitique[]; departements: { id: string; nom: string }[]; nombres: Record<string, number> }) {
  const { t } = useT()
  const router = useRouter()
  const confirmer = useConfirmer()
  const [edition, setEdition] = useState<string | 'nouvelle' | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const nomDep = new Map(departements.map(d => [d.id, d.nom]))
  const fini = () => { setEdition(null); router.refresh() }

  async function supprimer(c: CategoriePolitique) {
    if (!(await confirmer({ titre: t('Supprimer la catégorie'), message: t('Les politiques de {code} ne seront pas supprimées : elles passeront dans « Sans catégorie ».', { code: c.code }), bouton: t('Supprimer'), danger: true }))) return
    const r = await fetch(`/api/admin/politiques/categories/${c.id}`, { method: 'DELETE' })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) return setErreur(d.error ?? t('Erreur'))
    router.refresh()
  }

  return (
    <div className="space-y-3">
      {erreur && <p className="text-sm text-red-700">{erreur}</p>}
      {categories.length === 0 && edition !== 'nouvelle' && <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">{t('Aucune catégorie pour le moment.')}</div>}
      {categories.map(c => edition === c.id
        ? <FormCategorie key={c.id} initiale={c} departements={departements} onAnnuler={() => setEdition(null)} onEnregistree={fini} />
        : (
          <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
            <span className="text-2xl">{c.emoji ?? '📁'}</span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-900"><span className="font-mono">{c.code}</span> — {c.nom}</p>
              <p className="text-xs text-gray-500">
                {t('{n} politique(s)', { n: nombres[c.id] ?? 0 })}
                {' · '}
                {c.departements.length ? `🎯 ${c.departements.map(d => nomDep.get(d) ?? '?').join(', ')}` : t('Aucun département associé')}
              </p>
            </div>
            <button type="button" onClick={() => setEdition(c.id)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">{t('Modifier')}</button>
            <button type="button" onClick={() => supprimer(c)} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50">{t('Supprimer')}</button>
          </div>
        ))}
      {edition === 'nouvelle'
        ? <FormCategorie departements={departements} onAnnuler={() => setEdition(null)} onEnregistree={fini} />
        : <button type="button" onClick={() => setEdition('nouvelle')} className="w-full rounded-xl border-2 border-dashed border-gray-300 p-4 text-sm font-semibold text-gray-500 hover:border-indigo-400 hover:text-indigo-700">＋ {t('Nouvelle catégorie')}</button>}
    </div>
  )
}
