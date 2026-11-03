'use client'
// Création d'un type d'événement directement dans le formulaire d'événement.
import { useState } from 'react'
import { useT } from '@/lib/i18n/client'
import { EMOJIS_EVENEMENT, COULEURS_TYPE, FONDS_EVENEMENT, type TypePerso, type ModeEvenement } from '@/lib/evenements-types'

export default function NouveauType({ onCree, onAnnuler }: { onCree: (t: TypePerso) => void; onAnnuler: () => void }) {
  const { t } = useT()
  const [nom, setNom] = useState('')
  const [emoji, setEmoji] = useState('🎉')
  const [couleur, setCouleur] = useState(COULEURS_TYPE[5])
  const [fond, setFond] = useState<string>('lavande')
  const [mode, setMode] = useState<ModeEvenement>('participation')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function creer() {
    if (!nom.trim()) return setErreur(t('Le nom du type est obligatoire.'))
    setEnvoi(true); setErreur(null)
    const r = await fetch('/api/admin/evenements/types', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nom, emoji, couleur, fond, mode }) })
    const d = await r.json().catch(() => ({}))
    setEnvoi(false)
    if (!r.ok || !d.type) return setErreur(d.error ?? t('Erreur'))
    onCree(d.type as TypePerso)
  }

  return (
    <div className="mt-2 space-y-3 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50/40 p-4">
      <p className="text-sm font-bold text-gray-900">＋ {t('Nouveau type d’événement')}</p>
      {erreur && <p className="text-sm text-red-700">{erreur}</p>}
      <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={nom} onChange={e => setNom(e.target.value)} maxLength={60} placeholder={t('Ex. : Party de Noël, Journée santé, Assemblée…')} />
      <div>
        <span className="mb-1 block text-xs font-semibold text-gray-600">{t('Emoji')}</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {EMOJIS_EVENEMENT.map(em => <button key={em} type="button" onClick={() => setEmoji(em)} className={'flex h-9 w-9 items-center justify-center rounded-lg text-lg ' + (emoji === em ? 'bg-white ring-2 ring-indigo-500' : 'bg-white/60 hover:bg-white')}>{em}</button>)}
          <input className="h-9 w-16 rounded-lg border border-gray-300 text-center text-lg" maxLength={8} value={emoji} onChange={e => setEmoji(e.target.value)} aria-label={t('Autre emoji')} />
        </div>
      </div>
      <div>
        <span className="mb-1 block text-xs font-semibold text-gray-600">{t('Couleur')}</span>
        <div className="flex flex-wrap gap-2">
          {COULEURS_TYPE.map(c => <button key={c} type="button" onClick={() => setCouleur(c)} className={'h-8 w-8 rounded-full ' + (couleur === c ? 'ring-4 ring-offset-2' : '')} style={{ background: c, ['--tw-ring-color' as string]: c }} aria-label={c} />)}
        </div>
      </div>
      <div>
        <span className="mb-1 block text-xs font-semibold text-gray-600">{t('Fond par défaut')}</span>
        <div className="grid grid-cols-8 gap-1.5">
          {FONDS_EVENEMENT.map(f => <button key={f.id} type="button" onClick={() => setFond(f.id)} title={t(f.nom)} className={'h-9 rounded-lg ' + (fond === f.id ? 'ring-4 ring-indigo-500 ring-offset-1' : '')} style={{ background: f.hero }} />)}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {([['participation', '🎟️', t('« Je participe »'), t('Comme un 5 à 7 : on confirme sa présence, les initiales des collègues s’affichent.')], ['inscription', '📝', t('Inscription à une date'), t('Comme une formation : places, liste d’attente, présences.')]] as const).map(([m, e, l, aide]) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={'rounded-lg border-2 bg-white p-2.5 text-left ' + (mode === m ? 'border-indigo-500' : 'border-gray-200')}>
            <span className="text-sm font-semibold">{e} {l}</span>
            <span className="block text-xs text-gray-500">{aide}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <span className="rounded-full px-3 py-1 text-xs font-extrabold" style={{ background: `linear-gradient(135deg, ${couleur}1f, ${couleur}66)`, color: couleur }}>{emoji} {nom || t('Aperçu')}</span>
        <div className="flex-1" />
        <button type="button" onClick={onAnnuler} className="text-sm text-gray-500 hover:underline">{t('Annuler')}</button>
        <button type="button" onClick={creer} disabled={envoi} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{envoi ? '…' : t('Créer le type')}</button>
      </div>
    </div>
  )
}
