'use client'
// Bannière « comités » de la page d'accueil : image (téléversée ou adresse), titre et texte, avec aperçu.
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n/client'
import type { BanniereComites } from '@/lib/comites'

const champ = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

export default function BanniereComitesForm({ banniere, noms }: { banniere: BanniereComites; noms: string[] }) {
  const { t } = useT()
  const router = useRouter()
  const entree = useRef<HTMLInputElement>(null)
  const [b, setB] = useState(banniere)
  const [envoi, setEnvoi] = useState(false)
  const [televersement, setTeleversement] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null)

  async function televerser(f: File) {
    setTeleversement(true); setMessage(null)
    const fd = new FormData(); fd.append('file', f)
    const r = await fetch('/api/upload-lesson-image', { method: 'POST', body: fd })
    const d = await r.json().catch(() => ({}))
    setTeleversement(false)
    if (r.ok && d.url) setB(x => ({ ...x, image: d.url }))
    else setMessage({ ok: false, texte: d.error ?? t('Envoi impossible') })
  }

  async function enregistrer() {
    setEnvoi(true); setMessage(null)
    const r = await fetch('/api/admin/comites/banniere', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
    const d = await r.json().catch(() => ({}))
    setEnvoi(false)
    if (!r.ok) { setMessage({ ok: false, texte: d.error ?? t('Erreur') }); return }
    setB(d.banniere); setMessage({ ok: true, texte: t('Bannière enregistrée.') }); router.refresh()
  }

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
      <h2 className="text-base font-semibold text-gray-900">{t('Bannière de la page d’accueil')}</h2>
      <p className="text-xs text-gray-500 mb-4">{t('Affichée en haut de la page d’accueil des employés du WSSC dès qu’un comité est publié. Image conseillée : format paysage, au moins 1600 × 500 pixels.')}</p>

      {/* Aperçu */}
      <div className="relative rounded-2xl overflow-hidden mb-4" style={{ minHeight: 190, background: b.image ? `#0f172a url("${b.image}") center / cover no-repeat` : '#4f46e5' }}>
        {b.image && <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(15,23,42,0.88) 0%, rgba(15,23,42,0.6) 55%, rgba(15,23,42,0.15) 100%)' }} />}
        <div className="relative p-6 text-white max-w-xl flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider opacity-85">🤝 {t('Vos comités')}</span>
          <span className="text-2xl font-extrabold leading-tight">{b.titre || t('Apprenez à connaître vos comités')}</span>
          {b.texte && <span className="text-sm opacity-90">{b.texte}</span>}
          <span className="flex flex-wrap gap-2 mt-1">{noms.map(n => <span key={n} className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.3)' }}>{n}</span>)}</span>
          <span className="self-start mt-2 text-sm font-bold px-4 py-2 rounded-lg bg-white text-gray-900">{t('Découvrir vos comités')} →</span>
        </div>
      </div>

      <div className="grid gap-3">
        <div>
          <span className="block text-sm font-semibold text-gray-800 mb-1">{t('Image')}</span>
          <div className="flex flex-wrap gap-2 items-center">
            <button type="button" onClick={() => entree.current?.click()} disabled={televersement} className="text-sm font-semibold px-3 py-2 rounded-lg border border-indigo-600 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">
              {televersement ? t('Envoi…') : t('⬆ Téléverser une image')}
            </button>
            {b.image && <button type="button" onClick={() => setB(x => ({ ...x, image: '' }))} className="text-sm text-red-600 hover:underline">{t('Retirer l’image')}</button>}
            <span className="text-xs text-gray-500">{t('JPG, PNG ou WebP — 10 Mo max')}</span>
          </div>
          <input ref={entree} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) televerser(f); e.target.value = '' }} />
        </div>
        <label className="block">
          <span className="block text-sm font-semibold text-gray-800 mb-1">{t('Titre')}</span>
          <input className={champ} value={b.titre} maxLength={120} onChange={e => setB(x => ({ ...x, titre: e.target.value }))} />
        </label>
        <label className="block">
          <span className="block text-sm font-semibold text-gray-800 mb-1">{t('Texte')}</span>
          <input className={champ} value={b.texte} maxLength={300} onChange={e => setB(x => ({ ...x, texte: e.target.value }))} />
        </label>
      </div>

      {message && <div className={'mt-3 rounded-lg px-4 py-2 text-sm ' + (message.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700')}>{message.texte}</div>}
      <button type="button" onClick={enregistrer} disabled={envoi || televersement} className="mt-4 text-sm font-semibold px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">{envoi ? '…' : t('Enregistrer la bannière')}</button>
    </section>
  )
}
