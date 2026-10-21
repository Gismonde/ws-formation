'use client'
// Remplace les blocs « à ajouter » d'une formation par les éléments de la librairie du même titre.
import { useT } from '@/lib/i18n/client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Correspondance } from '@/lib/brancher-librairie'
const TYPE = { video: 'Vidéo', lien: 'Lien', document: 'Document' } as const

export default function BrancherLibrairie({ formationId, enAttente }: { formationId: string; enAttente: number }) {
  const { t } = useT()
  const router = useRouter()
  const [ouvert, setOuvert] = useState(false)
  const [liste, setListe] = useState<Correspondance[] | null>(null)
  const [choisis, setChoisis] = useState<Set<string>>(new Set())
  const [etat, setEtat] = useState<'' | 'chargement' | 'envoi'>('')
  const [message, setMessage] = useState<string | null>(null)

  const ouvrir = async () => {
    setOuvert(true); setEtat('chargement'); setMessage(null)
    const r = await fetch(`/api/admin/formations/${formationId}/brancher-librairie`)
    const d = await r.json().catch(() => ({}))
    setEtat('')
    if (!r.ok) { setMessage(d.error ?? t('Erreur')); return }
    const l = d.correspondances as Correspondance[]
    setListe(l)
    setChoisis(new Set(l.filter(c => c.element).map(c => c.bloc_id)))
  }

  const appliquer = async () => {
    setEtat('envoi')
    const r = await fetch(`/api/admin/formations/${formationId}/brancher-librairie`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ blocs: Array.from(choisis) }),
    })
    const d = await r.json().catch(() => ({}))
    setEtat('')
    if (!r.ok) { setMessage(d.error ?? t('Erreur')); return }
    setMessage(t('{n} bloc(s) branché(s) sur la librairie.', { n: d.branches }) + (d.restants ? ' ' + t('{n} reste(nt) à compléter à la main.', { n: d.restants }) : ''))
    setListe(null)
    router.refresh()
  }

  const basculer = (id: string) => setChoisis(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const trouves = liste?.filter(c => c.element) ?? []
  const manquants = liste?.filter(c => !c.element) ?? []

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-3 flex-wrap rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-sm text-amber-800">
          <strong>{enAttente} bloc{enAttente > 1 ? 's' : ''}{' '}{t('« à ajouter »')}</strong> {t('dans cette formation. La librairie peut les remplir automatiquement d’après leur titre.')}
        </p>
        <button onClick={ouvrir} className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700">{t('📚 Brancher la librairie')}</button>
      </div>

      {ouvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOuvert(false)}>
          <div className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{t('Brancher la librairie')}</h2>
                <p className="text-sm text-gray-500">{t('Vérifiez les correspondances, décochez celles qui ne conviennent pas, puis confirmez. Rien n’est modifié avant la confirmation.')}</p>
              </div>
              <button onClick={() => setOuvert(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            {etat === 'chargement' && <p className="text-sm text-gray-500">{t('Recherche des correspondances…')}</p>}
            {message && <p className="mb-4 text-sm rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 px-3 py-2">{message}</p>}

            {liste && (
              <>
                {trouves.length > 0 && (
                  <table className="w-full text-sm mb-5">
                    <thead><tr className="text-left text-xs uppercase text-gray-500 border-b"><th className="py-2 w-8"></th><th>{t('Leçon')}</th><th>{t('Élément de la librairie')}</th></tr></thead>
                    <tbody>
                      {trouves.map(c => (
                        <tr key={c.bloc_id} className="border-b border-gray-100 align-top">
                          <td className="py-2"><input type="checkbox" checked={choisis.has(c.bloc_id)} onChange={() => basculer(c.bloc_id)} /></td>
                          <td className="py-2 pr-3"><div className="font-medium text-gray-800">{c.lecon}</div><div className="text-xs text-gray-400">{c.module}</div></td>
                          <td className="py-2"><div className="text-gray-800">{c.element!.titre}</div><div className="text-xs text-gray-400">{TYPE[c.element!.type]}</div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {manquants.length > 0 && (
                  <div className="mb-5 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <p className="text-sm font-semibold text-gray-700 mb-1">Introuvables dans la librairie ({manquants.length}) — à ajouter à la librairie ou à compléter dans l’éditeur :</p>
                    <ul className="text-sm text-gray-600 list-disc pl-5">{manquants.map(c => <li key={c.bloc_id}>{c.cherche}</li>)}</ul>
                  </div>
                )}
                {liste.length === 0 && <p className="text-sm text-gray-500">{t('Aucun bloc « à ajouter » dans cette formation.')}</p>}
                <div className="flex justify-end gap-2">
                  <button onClick={() => setOuvert(false)} className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-700">{t('Annuler')}</button>
                  <button disabled={choisis.size === 0 || etat === 'envoi'} onClick={appliquer}
                    className="text-sm font-semibold px-4 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-50">
                    {etat === 'envoi' ? t('Enregistrement…') : t('Brancher {n} élément(s)', { n: choisis.size })}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
