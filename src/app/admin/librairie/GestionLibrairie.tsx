'use client'
// Admin → Librairie : vidéos, liens et documents réutilisables dans les leçons.
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { LIBELLE_TYPE_LIBRAIRIE, TYPES_LIBRAIRIE, plateformeVideo, type ElementLibrairie, type TypeLibrairie, type Utilisation } from '@/lib/librairie-commun'
import { analyserVideoEnLigne, estMediaPrive } from '@/lib/medias'
import { envoyerMedia } from '@/lib/medias-client'
import type { CliniqueContenu } from '@/lib/cliniques'

type Element = ElementLibrairie & { apercu: string | null; utilisations: Utilisation[] }
const LIBELLE_CLINIQUE: Record<CliniqueContenu, string> = { CMC: 'CMC', WSSC: 'WSSC', LES_DEUX: 'CMC + WSSC' }
const ICONE: Record<TypeLibrairie, string> = { video: '🎬', lien: '🔗', document: '📄' }
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const champ = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

type Brouillon = { id?: string; type: TypeLibrairie; titre: string; description: string; url: string; nom_fichier: string; categorie: string; clinique: CliniqueContenu }

export default function GestionLibrairie({ cliniques, peutImporter }: { cliniques: CliniqueContenu[]; peutImporter: boolean }) {
  const [type, setType] = useState<TypeLibrairie>('video')
  const [elements, setElements] = useState<Element[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [categorie, setCategorie] = useState('')
  const [archives, setArchives] = useState(false)
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [ouvert, setOuvert] = useState<string | null>(null)

  const charger = useCallback(async () => {
    setChargement(true); setErreur(null)
    const r = await fetch(`/api/admin/librairie?type=${type}${archives ? '&archives=1' : ''}`)
    const d = await r.json().catch(() => ({}))
    setChargement(false)
    if (!r.ok) { setErreur(d.error ?? 'Chargement impossible'); setElements([]); return }
    setElements(d.elements)
  }, [type, archives])
  useEffect(() => { charger() }, [charger])

  const categories = useMemo(() => Array.from(new Set(elements.map(e => e.categorie).filter(Boolean) as string[])).sort(), [elements])
  const visibles = elements.filter(e => (!categorie || e.categorie === categorie) && (!q || norm(`${e.titre} ${e.description ?? ''} ${e.categorie ?? ''}`).includes(norm(q))))

  function nouveau() {
    setMessage(null)
    setBrouillon({ type, titre: '', description: '', url: '', nom_fichier: '', categorie: categorie || '', clinique: cliniques.includes('LES_DEUX') ? 'LES_DEUX' : cliniques[0] })
  }
  function modifier(e: Element) {
    setMessage(null)
    setBrouillon({ id: e.id, type: e.type, titre: e.titre, description: e.description ?? '', url: e.url, nom_fichier: e.nom_fichier ?? '', categorie: e.categorie ?? '', clinique: e.clinique })
  }

  async function enregistrer() {
    if (!brouillon) return
    setEnCours(true); setErreur(null)
    const r = await fetch(brouillon.id ? `/api/admin/librairie/${brouillon.id}` : '/api/admin/librairie', {
      method: brouillon.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(brouillon),
    })
    const d = await r.json().catch(() => ({}))
    setEnCours(false)
    if (!r.ok) return setErreur(d.error ?? 'Enregistrement impossible')
    setMessage(brouillon.id ? `Enregistré.${d.blocsMisAJour ? ` ${d.blocsMisAJour} leçon(s) mise(s) à jour automatiquement.` : ''}` : 'Ajouté à la librairie.')
    setBrouillon(null)
    if (brouillon.type !== type) setType(brouillon.type); else charger()
  }

  async function archiver(e: Element, archive: boolean) {
    const r = await fetch(`/api/admin/librairie/${e.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archive }) })
    if (r.ok) charger(); else setErreur((await r.json().catch(() => ({}))).error ?? 'Opération impossible')
  }
  async function supprimer(e: Element) {
    if (!window.confirm(`Supprimer définitivement « ${e.titre} » de la librairie ?`)) return
    const r = await fetch(`/api/admin/librairie/${e.id}`, { method: 'DELETE' })
    if (r.ok) charger(); else setErreur((await r.json().catch(() => ({}))).error ?? 'Suppression impossible')
  }

  async function importerGrs() {
    if (!window.confirm('Importer dans la librairie les vidéos et les liens relevés dans la librairie GrS (clinique CMC) ? Les éléments déjà présents sont ignorés.')) return
    setEnCours(true); setErreur(null); setMessage(null)
    const r = await fetch('/api/admin/librairie/import-grs', { method: 'POST' })
    const d = await r.json().catch(() => ({}))
    setEnCours(false)
    if (!r.ok) return setErreur(d.error ?? 'Import impossible')
    setMessage(`${d.importes} élément(s) importé(s) de GrS${d.ignores ? `, ${d.ignores} déjà présent(s)` : ''}.`)
    charger()
  }

  async function televerser(f: File) {
    if (!brouillon) return
    setEnCours(true); setErreur(null)
    try {
      const ref = await envoyerMedia(f, brouillon.type === 'video' ? 'video' : 'fichier')
      setBrouillon(b => b && { ...b, url: ref, nom_fichier: f.name, titre: b.titre || f.name.replace(/\.[^.]+$/, '') })
    } catch (e) { setErreur((e as Error).message) }
    finally { setEnCours(false) }
  }

  const ongletCls = (actif: boolean) => 'px-4 py-2 rounded-lg text-sm font-semibold border ' + (actif ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300')

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Librairie</h1>
          <p className="text-sm text-gray-500 mt-1">Vidéos, liens et documents à réutiliser dans les leçons. Une modification ici met à jour toutes les leçons qui les utilisent.</p>
        </div>
        <div className="flex flex-wrap gap-2">
        {peutImporter && <button type="button" onClick={importerGrs} disabled={enCours} className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 disabled:opacity-40">⇣ Importer la librairie GrS</button>}
        <button type="button" onClick={nouveau} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold">+ Ajouter {type === 'video' ? 'une vidéo' : type === 'lien' ? 'un lien' : 'un document'}</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TYPES_LIBRAIRIE.map(t => (
          <button key={t} type="button" className={ongletCls(type === t)} onClick={() => { setType(t); setCategorie('') }}>{ICONE[t]} {LIBELLE_TYPE_LIBRAIRIE[t]}</button>
        ))}
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher…" className="ml-auto border border-gray-300 rounded-lg px-3 py-2 text-sm w-full sm:w-56" />
        <select value={categorie} onChange={e => setCategorie(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">Toutes les catégories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={archives} onChange={e => setArchives(e.target.checked)} /> Archivés</label>
      </div>

      {message && <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-2 text-sm">{message}</div>}
      {erreur && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm">{erreur}</div>}

      {brouillon && (
        <section className="bg-white border-2 border-indigo-200 rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-gray-900">{brouillon.id ? 'Modifier' : 'Ajouter'} — {ICONE[brouillon.type]} {LIBELLE_TYPE_LIBRAIRIE[brouillon.type].replace(/s$/, '')}</h2>
          {!brouillon.id && (
            <div className="flex gap-2">
              {TYPES_LIBRAIRIE.map(t => <button key={t} type="button" className={ongletCls(brouillon.type === t) + ' !py-1'} onClick={() => setBrouillon({ ...brouillon, type: t, url: '', nom_fichier: '' })}>{ICONE[t]} {LIBELLE_TYPE_LIBRAIRIE[t].replace(/s$/, '')}</button>)}
            </div>
          )}
          <input value={brouillon.titre} onChange={e => setBrouillon({ ...brouillon, titre: e.target.value })} placeholder="Titre *" className={champ + ' font-medium'} maxLength={300} />
          <div className="space-y-1">
            <input value={estMediaPrive(brouillon.url) ? '' : brouillon.url} onChange={e => setBrouillon({ ...brouillon, url: e.target.value.trim(), nom_fichier: '' })}
              placeholder={brouillon.type === 'video' ? 'Lien YouTube, Vimeo ou SharePoint' : brouillon.type === 'lien' ? 'Adresse https://…' : 'Adresse https://… du document (ou téléversez-le ci-dessous)'} className={champ} />
            {brouillon.type !== 'lien' && (
              <label className="inline-flex items-center gap-2 text-sm text-indigo-700 cursor-pointer">
                <span className="underline">{estMediaPrive(brouillon.url) ? `📎 ${brouillon.nom_fichier || 'Fichier téléversé'} — remplacer` : brouillon.type === 'video' ? 'ou téléverser un fichier vidéo (50 Mo max.)' : 'ou téléverser un document (PDF, Word, Excel, PowerPoint)'}</span>
                <input type="file" className="hidden" accept={brouillon.type === 'video' ? 'video/mp4,video/webm,video/quicktime' : '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx'} onChange={e => { const f = e.target.files?.[0]; if (f) televerser(f) }} />
              </label>
            )}
            {brouillon.type === 'video' && brouillon.url && !estMediaPrive(brouillon.url) && (
              <p className="text-xs text-gray-500">{analyserVideoEnLigne(brouillon.url) ? `✓ ${plateformeVideo(brouillon.url)} reconnu : le visionnement pourra être suivi.` : 'Lien SharePoint : la vidéo s’ouvrira dans un nouvel onglet (pas de suivi du visionnement).'}</p>
            )}
          </div>
          <textarea value={brouillon.description} onChange={e => setBrouillon({ ...brouillon, description: e.target.value })} placeholder="Description (facultatif)" rows={2} className={champ} maxLength={2000} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={brouillon.categorie} onChange={e => setBrouillon({ ...brouillon, categorie: e.target.value })} placeholder="Catégorie (ex. Santé et sécurité)" list="categories-librairie" className={champ} maxLength={80} />
            <datalist id="categories-librairie">{categories.map(c => <option key={c} value={c} />)}</datalist>
            <select value={brouillon.clinique} onChange={e => setBrouillon({ ...brouillon, clinique: e.target.value as CliniqueContenu })} className={champ}>
              {cliniques.map(c => <option key={c} value={c}>{LIBELLE_CLINIQUE[c]}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={enregistrer} disabled={enCours || !brouillon.titre || !brouillon.url} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-40">{enCours ? '…' : 'Enregistrer'}</button>
            <button type="button" onClick={() => setBrouillon(null)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm">Annuler</button>
          </div>
        </section>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {chargement ? <p className="p-8 text-center text-sm text-gray-400">Chargement…</p>
          : visibles.length === 0 ? <p className="p-8 text-center text-sm text-gray-400">Aucun élément.</p>
          : (
            <ul className="divide-y divide-gray-100">
              {visibles.map(e => {
                const lien = estMediaPrive(e.url) ? e.apercu : e.url
                return (
                  <li key={e.id} className={'px-4 py-3 ' + (e.archive ? 'opacity-60' : '')}>
                    <div className="flex flex-wrap items-start gap-3">
                      <span className="text-xl">{ICONE[e.type]}</span>
                      <div className="flex-1 min-w-[220px]">
                        <div className="font-medium text-gray-900">{e.titre}{e.archive && <span className="ml-2 text-xs text-gray-500">(archivé)</span>}</div>
                        <div className="text-xs text-gray-500 flex flex-wrap gap-x-3">
                          {e.type === 'video' && <span>{plateformeVideo(e.url)}</span>}
                          {e.categorie && <span>{e.categorie}</span>}
                          <span>{LIBELLE_CLINIQUE[e.clinique]}</span>
                          {e.source === 'grs' && <span>importé de GrS</span>}
                        </div>
                        {e.description && <p className="text-sm text-gray-600 mt-1">{e.description}</p>}
                        {e.utilisations.length > 0 && (
                          <button type="button" onClick={() => setOuvert(ouvert === e.id ? null : e.id)} className="text-xs text-indigo-700 mt-1">
                            Utilisé dans {e.utilisations.length} leçon(s) {ouvert === e.id ? '▲' : '▼'}
                          </button>
                        )}
                        {ouvert === e.id && (
                          <ul className="mt-1 text-xs text-gray-600 space-y-0.5">
                            {e.utilisations.map(u => (
                              <li key={u.bloc_id}>• <Link href={`/admin/formations/${u.formation_id}/editeur`} className="underline">{u.formation}</Link> › {u.module} › {u.lecon}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {lien && <a href={lien} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 rounded-md border border-gray-300 text-xs text-gray-700">Ouvrir ↗</a>}
                        <button type="button" onClick={() => modifier(e)} className="px-2.5 py-1 rounded-md border border-gray-300 text-xs text-gray-700">Modifier</button>
                        <button type="button" onClick={() => archiver(e, !e.archive)} className="px-2.5 py-1 rounded-md border border-gray-300 text-xs text-gray-700">{e.archive ? 'Désarchiver' : 'Archiver'}</button>
                        {e.utilisations.length === 0 && <button type="button" onClick={() => supprimer(e)} className="px-2.5 py-1 rounded-md border border-red-200 text-xs text-red-600">Supprimer</button>}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
      </div>
      <p className="text-xs text-gray-400">{visibles.length} élément(s). Les liens SharePoint ne s’ouvrent que pour les personnes ayant un compte Microsoft de la clinique.</p>
    </div>
  )
}
