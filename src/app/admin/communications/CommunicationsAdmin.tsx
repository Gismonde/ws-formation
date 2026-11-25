'use client'
// Liste et formulaire des affiches, guides et consentements (administration).
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n/client'
import { useConfirmer } from '@/components/Confirmation'
import { envoyerMedia } from '@/lib/medias-client'
import { CATEGORIES, categorieDe, type Categorie, type Communication } from '@/lib/communications'

const ROUTE = '/api/admin/communications/medias'
const champ = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
const LIBELLE_CLINIQUE: Record<string, string> = { WSSC: 'WSSC', CMC: 'CMC', LES_DEUX: 'Les deux cliniques' }

/** Page 1 d'un PDF en image (vignette), dans le navigateur. */
async function vignettePdf(fichier: File): Promise<File> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@' + pdfjsLib.version + '/build/pdf.worker.min.mjs'
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await fichier.arrayBuffer()) }).promise
  const page = await pdf.getPage(1)
  const v = page.getViewport({ scale: 700 / page.getViewport({ scale: 1 }).width })
  const canvas = document.createElement('canvas'); canvas.width = Math.round(v.width); canvas.height = Math.round(v.height)
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, viewport: v }).promise
  const blob: Blob = await new Promise((ok, ko) => canvas.toBlob(b => (b ? ok(b) : ko(new Error('Vignette impossible'))), 'image/webp', 0.85))
  return new File([blob], 'apercu.webp', { type: 'image/webp' })
}

type Edition = { id: string | null; categorie: Categorie; titre: string; description: string; clinique: string; fichier: string; type_fichier: string; apercu: string; nomFichier: string; publie: boolean }

export default function CommunicationsAdmin({ communications, cliniques, cliniqueDefaut }: { communications: Communication[]; cliniques: string[]; cliniqueDefaut: string }) {
  const { t, loc } = useT()
  const router = useRouter()
  const confirmer = useConfirmer()
  const entree = useRef<HTMLInputElement>(null)
  const vide: Edition = { id: null, categorie: 'communication', titre: '', description: '', clinique: cliniqueDefaut, fichier: '', type_fichier: '', apercu: '', nomFichier: '', publie: false }
  const [ed, setEd] = useState<Edition | null>(null)
  const [prevenir, setPrevenir] = useState(false)
  const [depot, setDepot] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; texte: string } | null>(null)

  async function deposer(f: File) {
    setMsg(null)
    try {
      setDepot(t('Envoi du fichier…'))
      const fichier = await envoyerMedia(f, f.type.startsWith('image/') ? 'image' : 'fichier', ROUTE)
      let apercu = ''
      if (f.type === 'application/pdf') { setDepot(t('Création de la vignette…')); apercu = await envoyerMedia(await vignettePdf(f), 'image', ROUTE).catch(() => '') }
      setEd(e => e && ({ ...e, fichier, apercu, type_fichier: f.type, nomFichier: f.name, titre: e.titre || f.name.replace(/\.[^.]+$/, '') }))
    } catch (e) { setMsg({ ok: false, texte: e instanceof Error ? e.message : t('Envoi impossible') }) }
    setDepot(null)
  }

  async function enregistrer(publie: boolean) {
    if (!ed) return
    setEnvoi(true); setMsg(null)
    const r = await fetch(ed.id ? `/api/admin/communications/${ed.id}` : '/api/admin/communications', {
      method: ed.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categorie: ed.categorie, titre: ed.titre, description: ed.description, clinique: ed.clinique, fichier: ed.fichier, type_fichier: ed.type_fichier, apercu: ed.apercu, publie, prevenir: publie && !ed.publie && prevenir }),
    })
    const d = await r.json().catch(() => ({}))
    setEnvoi(false)
    if (!r.ok) { setMsg({ ok: false, texte: d.error ?? t('Erreur') }); return }
    const c = d.courriels as { envoyes?: number; destinataires?: number; erreur?: string } | null
    setMsg({ ok: true, texte: publie ? (c ? (c.erreur ? t('Publiée. Courriel non envoyé : {e}', { e: c.erreur }) : t('Publiée. {n} courriel(s) envoyé(s) sur {total} employé(s) (les comptes pas encore activés ne reçoivent rien).', { n: c.envoyes ?? 0, total: c.destinataires ?? 0 })) : t('Publiée.')) : t('Enregistrée en brouillon.') })
    setEd(null); setPrevenir(false)
    router.refresh()
  }

  async function supprimer(c: Communication) {
    if (!(await confirmer({ message: t('Supprimer « {titre} » ? Elle disparaît pour tout le monde. Cette action est définitive.', { titre: c.titre }), bouton: t('Supprimer') }))) return
    const r = await fetch(`/api/admin/communications/${c.id}`, { method: 'DELETE' })
    if (!r.ok) { const d = await r.json().catch(() => ({})); setMsg({ ok: false, texte: d.error ?? t('Erreur') }); return }
    router.refresh()
  }

  return (
    <div className="space-y-5">
      {msg && <div className={'rounded-lg px-4 py-3 text-sm ' + (msg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700')}>{msg.texte}</div>}
      {!ed ? (
        <button type="button" onClick={() => { setEd(vide); setMsg(null) }} className="text-sm font-semibold px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">+ {t('Nouveau document')}</button>
      ) : (
        <section className="bg-white border border-gray-200 rounded-xl p-5 grid gap-4">
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <div>
              <span className="block text-sm font-semibold text-gray-800 mb-2">{t('Fichier (PDF ou image)')}</span>
              <div className="w-full max-w-[200px] aspect-[3/4] rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-xs text-gray-400 text-center p-2">
                {ed.fichier ? `✓ ${ed.nomFichier || t('Fichier déposé')}` : t('Aucun fichier')}
              </div>
              <button type="button" disabled={!!depot} onClick={() => entree.current?.click()} className="mt-3 text-sm font-semibold px-3 py-2 rounded-lg border border-indigo-600 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">{depot ?? (ed.fichier ? t('⬆ Remplacer le fichier') : t('⬆ Déposer le fichier'))}</button>
              <p className="text-xs text-gray-500 mt-1">{t('PDF, JPEG, PNG ou WebP — 25 Mo max.')}</p>
              <input ref={entree} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) deposer(f); e.target.value = '' }} />
            </div>
            <div className="grid gap-3 content-start">
              <label><span className="block text-xs font-semibold text-gray-700 mb-1">{t('Page')}</span>
                <select className={champ} value={ed.categorie} onChange={e => setEd({ ...ed, categorie: e.target.value as Categorie })}>
                  {(Object.keys(CATEGORIES) as Categorie[]).map(k => <option key={k} value={k}>{CATEGORIES[k].emoji} {t(CATEGORIES[k].libelle)}</option>)}
                </select>
              </label>
              <label><span className="block text-xs font-semibold text-gray-700 mb-1">{t('Titre')}</span><input className={champ} value={ed.titre} maxLength={200} onChange={e => setEd({ ...ed, titre: e.target.value })} /></label>
              <label><span className="block text-xs font-semibold text-gray-700 mb-1">{t('Description (facultatif)')}</span><textarea className={champ} rows={3} maxLength={2000} value={ed.description} onChange={e => setEd({ ...ed, description: e.target.value })} /></label>
              <label><span className="block text-xs font-semibold text-gray-700 mb-1">{t('Clinique')}</span>
                <select className={champ} value={ed.clinique} onChange={e => setEd({ ...ed, clinique: e.target.value })}>
                  {cliniques.map(c => <option key={c} value={c}>{t(LIBELLE_CLINIQUE[c] ?? c)}</option>)}
                </select>
              </label>
              {!ed.publie && (
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input type="checkbox" className="mt-1" checked={prevenir} onChange={e => setPrevenir(e.target.checked)} />
                  <span>{t('Prévenir les employés par courriel à la publication')}<span className="block text-xs text-gray-500">{t('Les employés de la clinique dont le compte est activé.')}</span></span>
                </label>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!ed.publie && <button type="button" disabled={envoi || !!depot} onClick={() => enregistrer(true)} className="text-sm font-semibold px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">{envoi ? '…' : t('Publier')}</button>}
            <button type="button" disabled={envoi || !!depot} onClick={() => enregistrer(ed.publie)} className="text-sm font-semibold px-4 py-2 rounded-lg border border-indigo-600 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">{ed.publie ? t('Enregistrer') : t('Enregistrer en brouillon')}</button>
            {ed.publie && <button type="button" disabled={envoi} onClick={() => enregistrer(false)} className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">{t('Retirer de la publication')}</button>}
            <button type="button" disabled={envoi} onClick={() => { setEd(null); setPrevenir(false) }} className="text-sm px-4 py-2 text-gray-600 hover:underline">{t('Annuler')}</button>
          </div>
        </section>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {communications.length === 0 && <p className="p-8 text-center text-sm text-gray-400">{t('Aucun document pour le moment.')}</p>}
        {communications.map(c => (
          <div key={c.id} className="flex items-center gap-4 px-5 py-3 border-b border-gray-100 last:border-0">
            <a href={`/api/communications/${c.id}/ouvrir`} target="_blank" rel="noopener" className="w-12 h-16 rounded bg-gray-50 border border-gray-200 overflow-hidden flex items-center justify-center shrink-0">
              {c.type_fichier.startsWith('image/') || c.apercu
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={`/api/communications/${c.id}/ouvrir?apercu=1`} alt="" className="w-full h-full object-cover" />
                : <span>📄</span>}
            </a>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 truncate">{c.titre}</p>
              <p className="text-xs text-gray-500">{CATEGORIES[categorieDe(c.categorie)].emoji} {t(CATEGORIES[categorieDe(c.categorie)].libelle)} · {t(LIBELLE_CLINIQUE[c.clinique] ?? c.clinique)} · {new Date(c.publie_le ?? c.cree_le).toLocaleDateString(loc, { dateStyle: 'medium' })}</p>
            </div>
            <span className={'text-xs font-semibold px-2.5 py-1 rounded-full ' + (c.publie ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600')}>{c.publie ? t('Publiée') : t('Brouillon')}</span>
            <button type="button" onClick={() => { setEd({ id: c.id, categorie: categorieDe(c.categorie), titre: c.titre, description: c.description, clinique: c.clinique, fichier: c.fichier, type_fichier: c.type_fichier, apercu: c.apercu, nomFichier: '', publie: c.publie }); setPrevenir(false); setMsg(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="text-sm text-indigo-700 hover:underline">{t('Modifier')}</button>
            <button type="button" onClick={() => supprimer(c)} className="text-sm text-red-600 hover:underline">{t('Supprimer')}</button>
          </div>
        ))}
      </div>
    </div>
  )
}
