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
      <p className="text-xs text-gray-500 mb-4">{t('Affichée en haut de la page d’accueil des employés du WSSC dès qu’un comité est publié. L’image est affichée en entier (format paysage conseillé) ; avec une image, le titre n’est pas répété par-dessus.')}</p>

      {/* Aperçu (identique à la page d'accueil) */}
      <div className="rounded-2xl overflow-hidden mb-4" style={{ background: '#0b2a5b' }}>
        {b.image
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={b.image} alt={b.titre} className="block w-full h-auto" />
          : <div className="px-6 pt-6 pb-1 text-white text-2xl font-extrabold">{b.titre || t('Apprenez à connaître vos comités')}</div>}
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 text-white">
          <div className="flex-1 min-w-[260px] flex flex-col gap-2">
            {b.texte && <span className="text-sm opacity-90">{b.texte}</span>}
            <span className="flex flex-wrap gap-2">{noms.map(n => <span key={n} className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(232,190,100,0.55)' }}>{n}</span>)}</span>
          </div>
          <span className="text-sm font-bold px-4 py-2 rounded-lg whitespace-nowrap" style={{ background: 'linear-gradient(180deg, #f3d27a, #d9a63e)', color: '#0b2a5b' }}>{t('Découvrir vos comités')} →</span>
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
            {b.image !== '/comites/banniere.webp' && <button type="button" onClick={() => setB(x => ({ ...x, image: '/comites/banniere.webp' }))} className="text-sm text-indigo-700 hover:underline">{t('Image d’origine')}</button>}
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
