'use client'
// Versions linguistiques : relier la version anglaise d'une formation française (ou retirer le lien).
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useT } from '@/lib/i18n/client'

type F = { id: string; titre: string }

export default function VersionsLangue({ formationId, francaise, anglaise, candidates }: {
  formationId: string
  /** Si cette formation est elle-même une version anglaise : sa version française */
  francaise: F | null
  anglaise: F | null
  candidates: F[]
}) {
  const { t } = useT()
  const router = useRouter()
  const [choix, setChoix] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; texte: string } | null>(null)

  const lier = async (racine: string, anglaiseId: string | null) => {
    setEnvoi(true); setMsg(null)
    const r = await fetch(`/api/admin/formations/${racine}/version-anglaise`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anglaise_id: anglaiseId }) })
    const d = await r.json().catch(() => ({}))
    setEnvoi(false)
    if (!r.ok) { setMsg({ ok: false, texte: d.error ?? t('Erreur') }); return }
    setMsg({ ok: true, texte: anglaiseId ? t('✓ Version anglaise reliée') : t('✓ Lien retiré') }); setChoix(''); router.refresh()
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
      <h2 className="text-sm font-semibold text-gray-900 mb-1">🌐 {t('Versions linguistiques')}</h2>
      <p className="text-xs text-gray-500 mb-3">{t('Chaque employé reçoit la version de sa langue de formation (fiche de l’employé ou son profil). Terminer l’une ou l’autre version compte pour la conformité et les prérequis.')}</p>
      {francaise ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">EN</span>
          <span>{t('Version anglaise de')} <Link className="text-indigo-700 hover:underline" href={`/admin/formations/${francaise.id}`}>« {francaise.titre} »</Link></span>
          <button type="button" disabled={envoi} onClick={() => lier(francaise.id, null)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">{t('Retirer le lien')}</button>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          {anglaise && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">EN</span>
              <Link className="text-indigo-700 hover:underline" href={`/admin/formations/${anglaise.id}`}>{anglaise.titre}</Link>
              <button type="button" disabled={envoi} onClick={() => lier(formationId, null)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">{t('Retirer le lien')}</button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label={t('Version anglaise')} value={choix} onChange={e => setChoix(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm max-w-full">
              <option value="">{anglaise ? t('Remplacer la version anglaise par…') : t('Choisir la version anglaise…')}</option>
              {candidates.map(c => <option key={c.id} value={c.id}>{c.titre}</option>)}
            </select>
            <button type="button" disabled={envoi || !choix} onClick={() => lier(formationId, choix)} className="text-sm px-4 py-1.5 rounded-lg bg-indigo-600 text-white disabled:opacity-50">{t('Relier')}</button>
          </div>
        </div>
      )}
      {msg && <p role="status" className={`text-xs mt-2 ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.texte}</p>}
    </div>
  )
}
