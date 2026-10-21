'use client'

import { useT } from '@/lib/i18n/client'
import { useConfirmer } from '@/components/Confirmation'
import { useRef, useState } from 'react'
import Link from 'next/link'
import { CLINIQUE_INFO, type Clinique } from '@/lib/cliniques'
import type { ContenuAccueil, CarteAccueil, PhotoAccueil } from '@/lib/accueil'

type Page = { clinique: Clinique; langue: 'fr' | 'en'; contenu: ContenuAccueil; defaut: ContenuAccueil; personnalisee: boolean; modifiee_le: string | null; disponible: boolean }

const champ = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white'
const etiquette = 'block text-xs font-semibold text-gray-600 mb-1'

/** Champ image : adresse https://, page /… ou fichier envoyé (JPG, PNG, WebP, 10 Mo max). */
function ChampImage({ valeur, onChange }: { valeur: string; onChange: (v: string) => void }) {
  const { t } = useT()
  const entree = useRef<HTMLInputElement>(null)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  async function envoyer(f: File) {
    setEnvoi(true); setErreur(null)
    const fd = new FormData(); fd.append('file', f)
    const r = await fetch('/api/upload-lesson-image', { method: 'POST', body: fd })
    const d = await r.json().catch(() => ({}))
    setEnvoi(false)
    if (r.ok && d.url) onChange(d.url); else setErreur(d.error ?? 'Envoi impossible')
  }
  return (
    <div className="flex gap-3 items-start">
      <div className="w-24 h-16 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 border border-gray-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {valeur && <img src={valeur} alt="" className="w-full h-full object-cover" />}
      </div>
      <div className="flex-1 min-w-0">
        <input value={valeur} onChange={e => onChange(e.target.value)} placeholder="https://… ou /cliniques/…" className={champ} />
        <div className="flex gap-3 mt-1 items-center">
          <button type="button" onClick={() => entree.current?.click()} disabled={envoi} className="text-xs font-semibold text-indigo-600 hover:underline">
            {envoi ? t('Envoi…') : t('⬆ Téléverser une photo')}
          </button>
          {valeur && <button type="button" onClick={() => onChange('')} className="text-xs text-gray-500 hover:underline">{t('Retirer')}</button>}
          {erreur && <span className="text-xs text-red-600">{erreur}</span>}
        </div>
        <input ref={entree} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) envoyer(f); e.target.value = '' }} />
      </div>
    </div>
  )
}

function deplacer<T>(liste: T[], i: number, d: -1 | 1): T[] {
  const j = i + d
  if (j < 0 || j >= liste.length) return liste
  const copie = [...liste]; [copie[i], copie[j]] = [copie[j], copie[i]]; return copie
}

export default function EditeurAccueil({ pages }: { pages: Page[] }) {
  const { t } = useT()
  const confirmer = useConfirmer()
  const cliniques = pages.map(p => p.clinique).filter((k, i, l) => l.indexOf(k) === i)
  const [clinique, setClinique] = useState(cliniques[0])
  const [langue, setLangue] = useState<'fr' | 'en'>('fr')
  const cle = (p: { clinique: Clinique; langue: string }) => `${p.clinique}-${p.langue}`
  const active = clinique ? `${clinique}-${langue}` : undefined
  const [contenus, setContenus] = useState<Record<string, ContenuAccueil>>(Object.fromEntries(pages.map(p => [cle(p), p.contenu])))
  const [etat, setEtat] = useState<{ type: 'ok' | 'erreur'; texte: string } | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [perso, setPerso] = useState<Record<string, boolean>>(Object.fromEntries(pages.map(p => [cle(p), p.personnalisee])))
  const page = pages.find(p => cle(p) === active)
  if (!page || !active) return <p className="text-gray-500">{t('Aucune clinique à administrer.')}</p>
  const c = contenus[active]
  const maj = (f: (c: ContenuAccueil) => ContenuAccueil) => setContenus(v => ({ ...v, [active]: f(v[active]) }))
  const majCarte = (i: number, champ: keyof CarteAccueil, val: string) => maj(x => ({ ...x, cartes: x.cartes.map((k, j) => (j === i ? { ...k, [champ]: val } : k)) }))
  const majPhoto = (i: number, champ: keyof PhotoAccueil, val: string) => maj(x => ({ ...x, visite: { ...x.visite, photos: x.visite.photos.map((k, j) => (j === i ? { ...k, [champ]: val } : k)) } }))

  async function enregistrer() {
    setEnCours(true); setEtat(null)
    const r = await fetch('/api/admin/accueil', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clinique, langue, contenu: c }) })
    const d = await r.json().catch(() => ({}))
    setEnCours(false)
    if (r.ok) { setContenus(v => ({ ...v, [active!]: d.contenu })); setPerso(v => ({ ...v, [active!]: true })); setEtat({ type: 'ok', texte: 'Page enregistrée. Les employés la voient dès maintenant.' }) }
    else setEtat({ type: 'erreur', texte: d.error ?? 'Enregistrement impossible' })
  }
  async function retablir() {
    if (!(await confirmer({ message: t('Rétablir le contenu par défaut de cette page ? Vos modifications seront perdues.'), bouton: t('Rétablir'), danger: true }))) return
    setEnCours(true); setEtat(null)
    const r = await fetch(`/api/admin/accueil?clinique=${clinique}&langue=${langue}`, { method: 'DELETE' })
    const d = await r.json().catch(() => ({}))
    setEnCours(false)
    if (r.ok) { setContenus(v => ({ ...v, [active!]: page!.defaut })); setPerso(v => ({ ...v, [active!]: false })); setEtat({ type: 'ok', texte: 'Contenu par défaut rétabli.' }) }
    else setEtat({ type: 'erreur', texte: d.error ?? t('Opération impossible') })
  }

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Page d’accueil des employés')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('Première page affichée aux employés après la connexion. Une page par clinique.')}</p>
        </div>
        <Link href="/dashboard/accueil" className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">{t('👁 Voir la page')}</Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        {cliniques.length > 1 && cliniques.map(k => (
          <button key={k} type="button" onClick={() => { setClinique(k); setEtat(null) }}
            className="px-4 py-2 rounded-full text-sm font-semibold border"
            style={clinique === k ? { background: CLINIQUE_INFO[k].couleur, color: '#fff', borderColor: CLINIQUE_INFO[k].couleur } : { background: '#fff', color: '#374151' }}>
            {CLINIQUE_INFO[k].court}
          </button>
        ))}
        <div className="inline-flex rounded-full border border-gray-300 bg-white p-0.5 ml-auto" role="group" aria-label={t('Langue de la page')}>
          {(['fr', 'en'] as const).map(l => (
            <button key={l} type="button" onClick={() => { setLangue(l); setEtat(null) }} aria-pressed={langue === l}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold ${langue === l ? 'bg-gray-900 text-white' : 'text-gray-600'}`}>
              {l === 'fr' ? 'Version française' : 'English version'}
            </button>
          ))}
        </div>
      </div>
      {langue === 'en' && !perso[active] && (
        <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl p-3 text-sm mb-5">
          {t('Version vue par les employés qui ont choisi l’anglais. Elle affiche le texte anglais par défaut tant qu’elle n’a pas été enregistrée ici.')}
        </div>
      )}

      {!page.disponible && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 text-sm mb-5">
          Le contenu par défaut est affiché. Pour enregistrer des modifications, exécutez d&apos;abord <code>{t('supabase/migrations/conformite_suivi.sql')}</code> {t('dans Supabase.')}
        </div>
      )}

      <div className="space-y-5">
        <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-gray-900">{t('Bannière')}</h2>
          <div><label className={etiquette}>{t('Titre *')}</label><input value={c.banniere.titre} onChange={e => maj(x => ({ ...x, banniere: { ...x.banniere, titre: e.target.value } }))} className={champ} maxLength={120} /></div>
          <div><label className={etiquette}>{t('Texte')}</label><textarea value={c.banniere.texte} onChange={e => maj(x => ({ ...x, banniere: { ...x.banniere, texte: e.target.value } }))} className={champ} rows={3} maxLength={600} /></div>
          <div><label className={etiquette}>{t('Photo')}</label><ChampImage valeur={c.banniere.image} onChange={v => maj(x => ({ ...x, banniere: { ...x.banniere, image: v } }))} /></div>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold text-gray-900">Cartes (liens et informations) — {c.cartes.length}/8</h2>
            {c.cartes.length < 8 && <button type="button" onClick={() => maj(x => ({ ...x, cartes: [...x.cartes, { titre: '', texte: '', image: '', lien: '' }] }))} className="text-sm font-semibold text-indigo-600">{t('+ Ajouter une carte')}</button>}
          </div>
          <p className="text-xs text-gray-500 mb-3">Lien : une adresse https://, une page de la plateforme (ex. /dashboard/sop) ou <code>{t('#visite')}</code> pour descendre à la visite virtuelle. Laissez vide pour une carte d&apos;information.</p>
          <div className="space-y-4">
            {c.cartes.map((k, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4 space-y-2">
                <div className="flex gap-2">
                  <input value={k.titre} onChange={e => majCarte(i, 'titre', e.target.value)} placeholder={t('Titre')} className={champ} maxLength={120} />
                  <button type="button" onClick={() => maj(x => ({ ...x, cartes: deplacer(x.cartes, i, -1) }))} className="px-2 text-gray-500" aria-label={t('Monter')}>↑</button>
                  <button type="button" onClick={() => maj(x => ({ ...x, cartes: deplacer(x.cartes, i, 1) }))} className="px-2 text-gray-500" aria-label={t('Descendre')}>↓</button>
                  <button type="button" onClick={() => maj(x => ({ ...x, cartes: x.cartes.filter((_, j) => j !== i) }))} className="px-2 text-red-600" aria-label={t('Supprimer')}>✕</button>
                </div>
                <input value={k.texte} onChange={e => majCarte(i, 'texte', e.target.value)} placeholder={t('Texte court')} className={champ} maxLength={600} />
                <input value={k.lien} onChange={e => majCarte(i, 'lien', e.target.value)} placeholder={t('Lien (https://…, /dashboard/…, #visite)')} className={champ} />
                <ChampImage valeur={k.image} onChange={v => majCarte(i, 'image', v)} />
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-gray-900">{t('Visite virtuelle —')}{' '}{c.visite.photos.length} photo(s)</h2>
            <button type="button" onClick={() => maj(x => ({ ...x, visite: { ...x.visite, photos: [...x.visite.photos, { url: '', legende: '' }] } }))} className="text-sm font-semibold text-indigo-600">{t('+ Ajouter une photo')}</button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className={etiquette}>{t('Titre')}</label><input value={c.visite.titre} onChange={e => maj(x => ({ ...x, visite: { ...x.visite, titre: e.target.value } }))} className={champ} /></div>
            <div><label className={etiquette}>{t('Texte')}</label><input value={c.visite.texte} onChange={e => maj(x => ({ ...x, visite: { ...x.visite, texte: e.target.value } }))} className={champ} /></div>
          </div>
          <div className="space-y-3">
            {c.visite.photos.map((p, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                <div className="flex gap-2">
                  <input value={p.legende} onChange={e => majPhoto(i, 'legende', e.target.value)} placeholder={t('Légende (ex. Salle d’opération)')} className={champ} maxLength={120} />
                  <button type="button" onClick={() => maj(x => ({ ...x, visite: { ...x.visite, photos: deplacer(x.visite.photos, i, -1) } }))} className="px-2 text-gray-500" aria-label={t('Monter')}>↑</button>
                  <button type="button" onClick={() => maj(x => ({ ...x, visite: { ...x.visite, photos: deplacer(x.visite.photos, i, 1) } }))} className="px-2 text-gray-500" aria-label={t('Descendre')}>↓</button>
                  <button type="button" onClick={() => maj(x => ({ ...x, visite: { ...x.visite, photos: x.visite.photos.filter((_, j) => j !== i) } }))} className="px-2 text-red-600" aria-label={t('Supprimer')}>✕</button>
                </div>
                <ChampImage valeur={p.url} onChange={v => majPhoto(i, 'url', v)} />
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-900 mb-2">{t('Informations pratiques')}</h2>
          <textarea value={c.infos} onChange={e => maj(x => ({ ...x, infos: e.target.value }))} className={champ} rows={3} maxLength={1000} placeholder={t('Adresse, téléphone, stationnement, personnes à contacter…')} />
        </section>
      </div>

      <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-gray-200 mt-6 -mx-4 px-4 py-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={enregistrer} disabled={enCours || !page.disponible} className="px-5 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-semibold disabled:opacity-50">
          {enCours ? 'Enregistrement…' : t('Enregistrer la page {clinique} ({langue})', { clinique: CLINIQUE_INFO[clinique].court, langue: langue.toUpperCase() })}
        </button>
        {page.disponible && <button type="button" onClick={retablir} disabled={enCours} className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-700">{t('Rétablir le contenu par défaut')}</button>}
        {etat && <span className={'text-sm ' + (etat.type === 'ok' ? 'text-green-700' : 'text-red-600')}>{etat.texte}</span>}
      </div>
    </div>
  )
}
