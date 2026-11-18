'use client'
// Une proposition reçue : texte, fichiers joints (aperçu des photos), statut et note interne.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n/client'
import { STATUTS_PROPOSITION, type FichierProposition, type StatutProposition } from '@/lib/passerelle-propositions'

type Carte = { id: string; sujet: string; message: string; fichiers: FichierProposition[]; statut: StatutProposition; note: string; auteur: string; poste: string | null; email: string | null; date: string }

export default function CarteProposition({ proposition: p }: { proposition: Carte }) {
  const { t } = useT()
  const router = useRouter()
  const [note, setNote] = useState(p.note)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const fichier = (i: number, telecharger = false) => `/api/passerelle/propositions/${p.id}/fichier?i=${i}${telecharger ? '&telecharger=1' : ''}`

  async function maj(corps: { statut?: StatutProposition; note?: string }) {
    setEnvoi(true); setErreur(null)
    const r = await fetch(`/api/passerelle/propositions/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) })
    setEnvoi(false)
    if (!r.ok) { const d = await r.json().catch(() => ({})); setErreur(d.error ?? t('Erreur')); return }
    router.refresh()
  }

  return (
    <article className="bg-white border border-gray-200 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{p.sujet}</h2>
          <p className="text-sm text-gray-500">{p.auteur}{p.poste ? ` · ${p.poste}` : ''} · {p.date}</p>
          {p.email && <a href={`mailto:${p.email}`} className="text-xs text-indigo-700 hover:underline">{p.email}</a>}
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: STATUTS_PROPOSITION[p.statut].bg, color: STATUTS_PROPOSITION[p.statut].color }}>{t(STATUTS_PROPOSITION[p.statut].libelle)}</span>
      </div>
      {p.message && <p className="text-[15px] text-gray-800 mt-3 whitespace-pre-line leading-relaxed">{p.message}</p>}
      {p.fichiers.length > 0 && (
        <div className="flex flex-wrap gap-3 mt-4">
          {p.fichiers.map((f, i) => (
            <div key={i} className="w-36">
              <a href={fichier(i)} target="_blank" rel="noopener" className="block w-36 h-28 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center hover:opacity-90">
                {f.type.startsWith('image/')
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={fichier(i)} alt={f.nom} className="w-full h-full object-cover" loading="lazy" />
                  : <span className="text-3xl">📄</span>}
              </a>
              <p className="text-xs text-gray-600 truncate mt-1" title={f.nom}>{f.nom}</p>
              <a href={fichier(i, true)} className="text-xs text-indigo-700 hover:underline">{t('Télécharger')}</a>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <label className="block">
          <span className="block text-xs font-semibold text-gray-700 mb-1">{t('Note de l’équipe (visible seulement par les personnes qui reçoivent les propositions)')}</span>
          <textarea className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" rows={2} value={note} onChange={e => setNote(e.target.value)} />
        </label>
        <div className="flex flex-wrap gap-2 mt-2">
          {note !== p.note && <button type="button" disabled={envoi} onClick={() => maj({ note })} className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">{t('Enregistrer la note')}</button>}
          {p.statut !== 'retenue' && <button type="button" disabled={envoi} onClick={() => maj({ statut: 'retenue', note })} className="text-sm font-semibold px-3 py-1.5 rounded-lg border border-green-600 text-green-700 hover:bg-green-50 disabled:opacity-50">✓ {t('Retenir')}</button>}
          {p.statut !== 'classee' && <button type="button" disabled={envoi} onClick={() => maj({ statut: 'classee', note })} className="text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50">{t('Classer')}</button>}
          {p.statut !== 'nouvelle' && <button type="button" disabled={envoi} onClick={() => maj({ statut: 'nouvelle', note })} className="text-sm text-gray-500 hover:underline disabled:opacity-50">{t('Remettre dans les nouvelles')}</button>}
        </div>
        {erreur && <p className="text-sm text-red-600 mt-2">{erreur}</p>}
      </div>
    </article>
  )
}
