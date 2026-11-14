'use client'
// Formulaire d'une édition de La Passerelle : dépôt du PDF (espace privé), couverture tirée de la page 1,
// date, numéro et temps de lecture repérés sur la couverture, sommaire, couleur, publication.
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useT } from '@/lib/i18n/client'
import { useConfirmer } from '@/components/Confirmation'
import { envoyerMedia } from '@/lib/medias-client'
import { COULEURS_EDITION, couleurEdition, infosCouverture, type Edition } from '@/lib/passerelle'

const champ = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

/** Page 1 du PDF en image (WebP) et son texte, dans le navigateur. */
async function lirePremierePage(fichier: File): Promise<{ image: File; texte: string }> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@' + pdfjsLib.version + '/build/pdf.worker.min.mjs'
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await fichier.arrayBuffer()) }).promise
  const page = await pdf.getPage(1)
  const vue = page.getViewport({ scale: 1 })
  const echelle = 900 / vue.width
  const v = page.getViewport({ scale: echelle })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(v.width); canvas.height = Math.round(v.height)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, viewport: v }).promise
  const blob: Blob = await new Promise((ok, ko) => canvas.toBlob(b => (b ? ok(b) : ko(new Error('Image impossible'))), 'image/webp', 0.85))
  const contenu = await page.getTextContent()
  const texte = contenu.items.map(i => ('str' in i ? i.str : '')).join(' ')
  return { image: new File([blob], 'couverture.webp', { type: 'image/webp' }), texte }
}

export default function EditionForm({ edition, apercuCouverture }: { edition: Edition | null; apercuCouverture: string | null }) {
  const { t } = useT()
  const router = useRouter()
  const confirmer = useConfirmer()
  const entree = useRef<HTMLInputElement>(null)
  const [f, setF] = useState({
    numero: edition?.numero ? String(edition.numero) : '', volume: String(edition?.volume ?? 1), date_parution: edition?.date_parution ?? '',
    temps_lecture: edition?.temps_lecture ? String(edition.temps_lecture) : '', accroche: edition?.accroche ?? '',
    sommaire: (edition?.sommaire ?? []).map(s => (s.page ? `${s.titre} | ${s.page}` : s.titre)).join('\n'),
    couleur: edition?.couleur ?? 'bleu', pdf: edition?.pdf ?? '', couverture: edition?.couverture ?? '', publie: edition?.publie ?? false,
  })
  const [apercu, setApercu] = useState<string | null>(apercuCouverture)
  const [depot, setDepot] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null)
  const maj = (k: keyof typeof f, v: string | boolean) => setF(x => ({ ...x, [k]: v }))
  const k = couleurEdition(f.couleur)

  async function deposer(fichier: File) {
    setMessage(null)
    try {
      setDepot(t('Lecture de la couverture…'))
      const { image, texte } = await lirePremierePage(fichier)
      const infos = infosCouverture(texte)
      setApercu(URL.createObjectURL(image))
      setDepot(t('Envoi du PDF…'))
      const pdf = await envoyerMedia(fichier, 'fichier')
      setDepot(t('Envoi de la couverture…'))
      const couverture = await envoyerMedia(image, 'image')
      setF(x => ({
        ...x, pdf, couverture,
        numero: x.numero || (infos.numero ? String(infos.numero) : ''), volume: infos.volume ? String(infos.volume) : x.volume,
        date_parution: x.date_parution || (infos.date_parution ?? ''), temps_lecture: x.temps_lecture || (infos.temps_lecture ? String(infos.temps_lecture) : ''),
      }))
      setDepot(null)
    } catch (e) {
      setDepot(null)
      setMessage({ ok: false, texte: e instanceof Error ? e.message : t('Envoi impossible') })
    }
  }

  async function enregistrer(publie = f.publie) {
    setEnvoi(true); setMessage(null)
    const r = await fetch(edition ? `/api/admin/passerelle/${edition.id}` : '/api/admin/passerelle', {
      method: edition ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...f, publie }),
    })
    const d = await r.json().catch(() => ({}))
    setEnvoi(false)
    if (!r.ok) { setMessage({ ok: false, texte: d.error ?? t('Erreur') }); return }
    setF(x => ({ ...x, publie }))
    if (!edition) { router.push(`/admin/passerelle/${d.edition.id}`); return }
    setMessage({ ok: true, texte: publie ? t('Enregistrée. L’édition est visible par les employés du WSSC.') : t('Enregistrée. L’édition est en brouillon : seuls les administrateurs la voient.') })
    router.refresh()
  }

  async function supprimer() {
    if (!edition) return
    if (!(await confirmer({ message: t('Retirer l’édition {n} de La Passerelle ? Elle disparaît pour tout le monde. Cette action est définitive.', { n: edition.numero }), bouton: t('Retirer') }))) return
    const r = await fetch(`/api/admin/passerelle/${edition.id}`, { method: 'DELETE' })
    if (!r.ok) { const d = await r.json().catch(() => ({})); setMessage({ ok: false, texte: d.error ?? t('Erreur') }); return }
    router.push('/admin/passerelle'); router.refresh()
  }

  return (
    <div className="space-y-6">
      <section className="bg-white border border-gray-200 rounded-xl p-5 grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div>
          <span className="block text-sm font-semibold text-gray-800 mb-2">{t('PDF de l’édition')}</span>
          <div className="w-full max-w-[220px] aspect-[3/4] rounded-lg overflow-hidden border border-gray-200 flex items-center justify-center text-xs text-gray-400" style={{ background: k.fond, borderTop: `4px solid ${k.accent}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {apercu ? <img src={apercu} alt="" className="w-full h-full object-cover" /> : t('Couverture (page 1)')}
          </div>
          <button type="button" onClick={() => entree.current?.click()} disabled={!!depot} className="mt-3 text-sm font-semibold px-3 py-2 rounded-lg border border-indigo-600 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">
            {depot ?? (f.pdf ? t('⬆ Remplacer le PDF') : t('⬆ Déposer le PDF'))}
          </button>
          <p className="text-xs text-gray-500 mt-1">{t('PDF, 20 Mo max. La date, le numéro et le temps de lecture sont repérés sur la couverture : vérifiez-les.')}</p>
          <input ref={entree} type="file" accept="application/pdf" className="hidden" onChange={e => { const fi = e.target.files?.[0]; if (fi) deposer(fi); e.target.value = '' }} />
        </div>
        <div className="grid gap-3 content-start">
          <div className="grid grid-cols-3 gap-3">
            <label><span className="block text-xs font-semibold text-gray-700 mb-1">{t('Édition n°')}</span><input type="number" className={champ} value={f.numero} onChange={e => maj('numero', e.target.value)} /></label>
            <label><span className="block text-xs font-semibold text-gray-700 mb-1">{t('Volume')}</span><input type="number" className={champ} value={f.volume} onChange={e => maj('volume', e.target.value)} /></label>
            <label><span className="block text-xs font-semibold text-gray-700 mb-1">{t('Lecture (min)')}</span><input type="number" className={champ} value={f.temps_lecture} onChange={e => maj('temps_lecture', e.target.value)} /></label>
          </div>
          <label><span className="block text-xs font-semibold text-gray-700 mb-1">{t('Date de parution')}</span><input type="date" className={champ} value={f.date_parution} onChange={e => maj('date_parution', e.target.value)} /></label>
          <div>
            <span className="block text-xs font-semibold text-gray-700 mb-1">{t('Couleur de l’édition')}</span>
            <div className="flex flex-wrap gap-2">
              {Object.entries(COULEURS_EDITION).map(([cle, c]) => (
                <button key={cle} type="button" title={t(c.libelle)} aria-label={t(c.libelle)} onClick={() => maj('couleur', cle)} className="w-8 h-8 rounded-full border-2" style={{ background: c.accent, borderColor: f.couleur === cle ? '#111827' : 'transparent' }} />
              ))}
            </div>
          </div>
          <label><span className="block text-xs font-semibold text-gray-700 mb-1">{t('Accroche (facultatif)')}</span><textarea className={champ} rows={2} value={f.accroche} onChange={e => maj('accroche', e.target.value)} /></label>
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <span className="block text-sm font-semibold text-gray-800">{t('Ce qui vous attend dans cette édition')}</span>
        <span className="block text-xs text-gray-500 mb-2">{t('Une ligne par article, avec la page après une barre : « Santé et sécurité au travail | 6 ».')}</span>
        <textarea className={champ} rows={5} value={f.sommaire} onChange={e => maj('sommaire', e.target.value)} />
      </section>

      {message && <div className={'rounded-lg px-4 py-3 text-sm ' + (message.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700')}>{message.texte}</div>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={envoi || !!depot} onClick={() => enregistrer()} className="text-sm font-semibold px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
          {envoi ? '…' : edition ? t('Enregistrer') : t('Ajouter l’édition (brouillon)')}
        </button>
        {edition && (f.publie
          ? <button type="button" disabled={envoi} onClick={() => enregistrer(false)} className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">{t('Repasser en brouillon')}</button>
          : <button type="button" disabled={envoi} onClick={() => enregistrer(true)} className="text-sm font-semibold px-4 py-2 rounded-lg border border-green-600 text-green-700 hover:bg-green-50">{t('Publier pour les employés du WSSC')}</button>)}
        {edition && <Link href="/dashboard/passerelle" className="text-sm text-indigo-700 hover:underline">{t('Voir comme un employé')} →</Link>}
        <span className={'text-xs font-semibold px-2.5 py-1 rounded-full ' + (f.publie ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600')}>{f.publie ? t('Publiée') : t('Brouillon')}</span>
        {edition && <button type="button" onClick={supprimer} className="ml-auto text-sm text-red-600 hover:underline">{t('Retirer l’édition')}</button>}
      </div>
    </div>
  )
}
