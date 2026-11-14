'use client'
// Encadré « On veut vous lire ! » en bas de La Passerelle.
import { useState } from 'react'
import { useT } from '@/lib/i18n/client'
import type { AppelPasserelle } from '@/lib/passerelle'

const champ = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

export default function AppelForm({ appel }: { appel: AppelPasserelle }) {
  const { t } = useT()
  const [a, setA] = useState(appel)
  const [etat, setEtat] = useState<{ ok: boolean; texte: string } | null>(null)
  async function enregistrer() {
    setEtat(null)
    const r = await fetch('/api/admin/passerelle/appel', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(a) })
    const d = await r.json().catch(() => ({}))
    setEtat(r.ok ? { ok: true, texte: t('Encadré enregistré.') } : { ok: false, texte: d.error ?? t('Erreur') })
  }
  return (
    <section className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="text-base font-semibold text-gray-900">{t('Encadré « On veut vous lire ! »')}</h2>
      <p className="text-xs text-gray-500 mb-3">{t('Affiché en bas de La Passerelle pour inviter les employés à proposer un article. Laissez le texte vide pour ne pas l’afficher.')}</p>
      <input className={champ + ' mb-2'} value={a.titre} onChange={e => setA(x => ({ ...x, titre: e.target.value }))} />
      <textarea className={champ} rows={6} value={a.texte} onChange={e => setA(x => ({ ...x, texte: e.target.value }))} />
      {etat && <p className={'text-sm mt-2 ' + (etat.ok ? 'text-green-700' : 'text-red-600')}>{etat.texte}</p>}
      <button type="button" onClick={enregistrer} className="mt-3 text-sm font-semibold px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">{t('Enregistrer')}</button>
    </section>
  )
}
