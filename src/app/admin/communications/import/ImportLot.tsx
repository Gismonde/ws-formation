'use client'
// Import en lot des guides et consentements : glisser-déposer un dossier, des fichiers ou un ZIP.
import { useRef, useState } from 'react'
import JSZip from 'jszip'
import { envoyerMedia } from '@/lib/medias-client'
import { cheminTheme, type Theme } from '@/lib/communications'
import { vignettePdf } from '../CommunicationsAdmin'
import MANIFESTE from '@/data/import-guides-2026-11.json'

type Entree = { titre: string; description: string; categorie: string; public: string; reserve: boolean; clinique: string; chemins: string[][]; type: string }
const M = MANIFESTE as Record<string, Entree>
const ROUTE = '/api/admin/communications/medias'

const empreinte = async (buf: ArrayBuffer) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))].map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 16)

// Fichiers d'un glisser-déposer, dossiers compris
async function lireDepot(items: DataTransferItemList): Promise<File[]> {
  const out: File[] = []
  const lire = async (e: FileSystemEntry): Promise<void> => {
    if (e.isFile) out.push(await new Promise<File>((ok, ko) => (e as FileSystemFileEntry).file(ok, ko)))
    else if (e.isDirectory) {
      const r = (e as FileSystemDirectoryEntry).createReader()
      for (;;) {
        const lot = await new Promise<FileSystemEntry[]>((ok, ko) => r.readEntries(ok, ko))
        if (!lot.length) break
        for (const x of lot) await lire(x)
      }
    }
  }
  const entrees = [...items].map(i => i.webkitGetAsEntry()).filter(Boolean) as FileSystemEntry[]
  for (const e of entrees) await lire(e)
  return out
}

export default function ImportLot({ themes, departements, existants }: { themes: Theme[]; departements: string[]; existants: string[] }) {
  const [survol, setSurvol] = useState(false)
  const [etat, setEtat] = useState<string | null>(null)
  const [journal, setJournal] = useState<string[]>([])
  const [occupe, setOccupe] = useState(false)
  const fichiersRef = useRef<HTMLInputElement>(null)
  const dossierRef = useRef<HTMLInputElement>(null)
  const deja = useRef(new Set(existants))
  const total = Object.keys(M).length

  // chemin « Chirurgie > Orthopédie > Dr X » -> id
  const idDe = (chemin: string[]) => themes.find(t => cheminTheme(t.id, themes).map(x => x.nom).join('>') === chemin.join('>'))?.id

  async function traiter(fichiers: File[]) {
    setOccupe(true); setJournal([])
    const trouves = new Map<string, { f: File; e: Entree }>()
    let lus = 0
    const ranger = async (nom: string, buf: ArrayBuffer) => {
      const e = M[await empreinte(buf)]
      if (e && !trouves.has(e.titre)) trouves.set(e.titre, { f: new File([buf], nom.split('/').pop() ?? nom, { type: e.type }), e })
    }
    for (const f of fichiers) {
      if (/\.zip$/i.test(f.name)) {
        setEtat('Ouverture du ZIP…')
        const z = await JSZip.loadAsync(f)
        for (const x of Object.values(z.files)) {
          if (x.dir || !/\.(pdf|png)$/i.test(x.name)) continue
          await ranger(x.name, await x.async('arraybuffer')); setEtat(`Lecture… ${++lus} fichier(s)`)
        }
      } else if (/\.(pdf|png)$/i.test(f.name)) { await ranger(f.name, await f.arrayBuffer()); setEtat(`Lecture… ${++lus} fichier(s)`) }
    }
    let faits = 0, ignores = 0
    const erreurs: string[] = []
    const liste = [...trouves.values()]
    for (const { f, e } of liste) {
      const cle = `${e.categorie}|${e.titre}`
      if (deja.current.has(cle)) { ignores++; continue }
      setEtat(`Publication… ${faits + 1} / ${liste.length - ignores} — ${e.titre}`)
      try {
        const fichier = await envoyerMedia(f, e.type === 'image/png' ? 'image' : 'fichier', ROUTE)
        const apercu = e.type === 'application/pdf' ? await vignettePdf(f).then(v => envoyerMedia(v, 'image', ROUTE)).catch(() => '') : ''
        const r = await fetch('/api/admin/communications', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ categorie: e.categorie, titre: e.titre, description: e.description, clinique: e.clinique, public: e.public,
            themes: e.chemins.map(idDe).filter(Boolean), departements: e.reserve ? departements : [], fichier, type_fichier: e.type, apercu, publie: true, prevenir: false }),
        })
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.error ?? 'Erreur')
        deja.current.add(cle); faits++
      } catch (err) { erreurs.push(`${e.titre} : ${err instanceof Error ? err.message : 'erreur'}`) }
    }
    setJournal(erreurs)
    setEtat(`✓ Terminé : ${faits} publié(s)${ignores ? `, ${ignores} déjà publié(s)` : ''}${erreurs.length ? `, ${erreurs.length} erreur(s)` : ''}. ${lus - trouves.size > 0 ? `${lus - trouves.size} fichier(s) non reconnu(s) ou en double ignoré(s).` : ''}`)
    setOccupe(false)
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={e => { e.preventDefault(); setSurvol(true) }}
        onDragLeave={() => setSurvol(false)}
        onDrop={async e => { e.preventDefault(); setSurvol(false); if (!occupe) traiter(await lireDepot(e.dataTransfer.items)) }}
        className={'rounded-2xl border-2 border-dashed p-12 text-center transition ' + (survol ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 bg-white')}>
        <p className="text-4xl mb-3">📂</p>
        <p className="font-semibold text-gray-900">Glissez ici le dossier complet ou le fichier ZIP</p>
        <p className="text-sm text-gray-500 mt-1">{total} documents attendus (guides, consentements, affiche)</p>
        <div className="flex flex-wrap justify-center gap-2 mt-5">
          <button type="button" disabled={occupe} onClick={() => dossierRef.current?.click()} className="text-sm font-semibold px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">Choisir un dossier</button>
          <button type="button" disabled={occupe} onClick={() => fichiersRef.current?.click()} className="text-sm font-semibold px-4 py-2 rounded-lg border border-indigo-600 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">Choisir le ZIP ou des fichiers</button>
        </div>
        <input ref={fichiersRef} type="file" multiple accept=".zip,application/zip,application/pdf,image/png" className="hidden" onChange={e => { const f = [...(e.target.files ?? [])]; e.target.value = ''; if (f.length) traiter(f) }} />
        {/* @ts-expect-error webkitdirectory n'est pas dans les types React */}
        <input ref={dossierRef} type="file" webkitdirectory="" directory="" multiple className="hidden" onChange={e => { const f = [...(e.target.files ?? [])]; e.target.value = ''; if (f.length) traiter(f) }} />
      </div>
      {etat && <div className={'rounded-xl px-4 py-3 text-sm ' + (etat.startsWith('✓') ? 'bg-green-50 text-green-800' : 'bg-indigo-50 text-indigo-900')}>{etat}{occupe && <span className="block text-xs mt-1 opacity-80">Laissez cette page ouverte pendant l’envoi.</span>}</div>}
      {journal.length > 0 && <ul className="rounded-xl bg-red-50 text-red-700 text-sm px-4 py-3 list-disc pl-8">{journal.map(j => <li key={j}>{j}</li>)}</ul>}
    </div>
  )
}
