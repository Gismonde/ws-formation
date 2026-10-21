'use client'
// Dupliquer une formation : choix de la clinique et du titre, copie en brouillon.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n/client'
import { CLINIQUE_CONTENU_LABEL, type CliniqueContenu } from '@/lib/cliniques'

export default function DupliquerFormation({ formationId, titre, clinique, cliniques }: { formationId: string; titre: string; clinique: CliniqueContenu; cliniques: CliniqueContenu[] }) {
  const { t } = useT()
  const router = useRouter()
  const [ouvert, setOuvert] = useState(false)
  const [cible, setCible] = useState<CliniqueContenu>(cliniques.includes(clinique) ? clinique : cliniques[0])
  const [nom, setNom] = useState(`${titre} (${t('copie')})`)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const dupliquer = async () => {
    setEnvoi(true); setErreur(null)
    const r = await fetch(`/api/admin/formations/${formationId}/dupliquer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clinique: cible, titre: nom }) })
    const d = await r.json().catch(() => ({}))
    setEnvoi(false)
    if (!r.ok) { setErreur(d.error ?? t('Erreur')); return }
    router.push(`/admin/formations/${d.id}`)
  }

  if (cliniques.length === 0) return null
  return (
    <>
      <button type="button" onClick={() => setOuvert(true)} className="text-sm font-semibold px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50">⧉ {t('Dupliquer')}</button>
      {ouvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOuvert(false)}>
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-1">{t('Dupliquer la formation')}</h2>
            <p className="text-sm text-gray-500 mb-4">{t('Modules, leçons, contenus et questionnaire sont copiés. La copie est créée en brouillon, sans assignation.')}</p>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Titre de la copie')}</label>
            <input value={nom} onChange={e => setNom(e.target.value)} maxLength={300} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3" />
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Clinique')}</label>
            <select value={cible} onChange={e => setCible(e.target.value as CliniqueContenu)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4">
              {cliniques.map(c => <option key={c} value={c}>{t(CLINIQUE_CONTENU_LABEL[c])}</option>)}
            </select>
            {erreur && <p className="text-sm text-red-600 mb-3">{erreur}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOuvert(false)} className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-700">{t('Annuler')}</button>
              <button type="button" onClick={dupliquer} disabled={envoi || !nom.trim()} className="text-sm font-semibold px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50">{envoi ? t('Copie en cours…') : t('Dupliquer')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
