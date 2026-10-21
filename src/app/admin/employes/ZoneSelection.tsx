'use client'
// Sélection de plusieurs employés dans la liste (cases à cocher rendues par le serveur)
// et actions groupées : exporter (Excel ou ZIP), archiver, réactiver.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type Selection = { ids: string[]; archivables: string[]; reactivables: string[] }
const VIDE: Selection = { ids: [], archivables: [], reactivables: [] }

export default function ZoneSelection({ children }: { children: React.ReactNode }) {
  const zone = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const [sel, setSel] = useState<Selection>(VIDE)
  const [enCours, setEnCours] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'erreur'; texte: string } | null>(null)

  const lire = useCallback(() => {
    const cases = Array.from(zone.current?.querySelectorAll<HTMLInputElement>('input[name="employe"]:checked') ?? [])
    setSel({
      ids: cases.map(c => c.value),
      archivables: cases.filter(c => c.dataset.gerable === '1' && c.dataset.actif === '1').map(c => c.value),
      reactivables: cases.filter(c => c.dataset.gerable === '1' && c.dataset.actif === '0').map(c => c.value),
    })
    // État des cases « tout sélectionner » de chaque tableau
    zone.current?.querySelectorAll<HTMLInputElement>('input[data-tout]').forEach(t => {
      const groupe = Array.from(zone.current!.querySelectorAll<HTMLInputElement>(`input[name="employe"][data-groupe="${t.dataset.tout}"]`))
      const coches = groupe.filter(c => c.checked).length
      t.checked = groupe.length > 0 && coches === groupe.length
      t.indeterminate = coches > 0 && coches < groupe.length
    })
  }, [])

  useEffect(() => {
    const el = zone.current
    if (!el) return
    const changement = (e: Event) => {
      const t = e.target as HTMLInputElement
      if (t.dataset.tout) {
        el.querySelectorAll<HTMLInputElement>(`input[name="employe"][data-groupe="${t.dataset.tout}"]`).forEach(c => { c.checked = t.checked })
      }
      if (t.name === 'employe' || t.dataset.tout) lire()
    }
    el.addEventListener('change', changement)
    return () => el.removeEventListener('change', changement)
  }, [lire])

  function toutDecocher() {
    zone.current?.querySelectorAll<HTMLInputElement>('input[name="employe"]').forEach(c => { c.checked = false })
    lire()
  }

  function exporter(format: 'xlsx' | 'zip') {
    window.location.href = `/api/admin/employes/export?format=${format}&ids=${sel.ids.join(',')}`
  }

  async function archiver(actif: boolean) {
    const ids = actif ? sel.reactivables : sel.archivables
    if (!window.confirm(`${actif ? 'Réactiver' : 'Archiver'} ${ids.length} employé(s) ?${actif ? '' : ' Leurs sessions seront fermées.'}`)) return
    setEnCours(true); setMessage(null)
    const r = await fetch('/api/admin/employes/archiver', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, actif }),
    })
    const d = await r.json().catch(() => ({}))
    setEnCours(false)
    if (!r.ok) return setMessage({ type: 'erreur', texte: d.error ?? 'Opération impossible' })
    setMessage({ type: 'ok', texte: `${d.traites} employé(s) ${actif ? 'réactivé(s)' : 'archivé(s)'}.` + (d.ignores ? ` ${d.ignores} ignoré(s) (hors de votre périmètre ou déjà dans cet état).` : '') })
    toutDecocher()
    router.refresh()
  }

  const n = sel.ids.length
  const bouton = 'px-3 py-1.5 rounded-lg text-sm font-semibold border disabled:opacity-40'
  return (
    <div ref={zone}>
      {message && (
        <div className={'mb-3 rounded-lg px-4 py-2 text-sm ' + (message.type === 'ok' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200')}>
          {message.texte}
        </div>
      )}
      {n > 0 && (
        <div className="sticky top-14 md:top-16 z-40 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 shadow-sm">
          <span className="text-sm font-semibold text-indigo-900 mr-2">{n} sélectionné(s)</span>
          <a href={`/admin/assigner?employes=${sel.ids.join(',')}`} className={bouton + ' bg-indigo-600 border-indigo-600 text-white'}>Assigner…</a>
          <button type="button" className={bouton + ' bg-white border-gray-300 text-gray-700'} onClick={() => exporter('xlsx')} disabled={enCours}>⬇ Excel</button>
          <button type="button" className={bouton + ' bg-white border-gray-300 text-gray-700'} onClick={() => exporter('zip')} disabled={enCours} title="Classeur Excel et documents de preuves">⬇ Dossiers complets (ZIP)</button>
          {sel.archivables.length > 0 && (
            <button type="button" className={bouton + ' bg-white border-orange-200 text-orange-700'} onClick={() => archiver(false)} disabled={enCours}>
              Archiver ({sel.archivables.length})
            </button>
          )}
          {sel.reactivables.length > 0 && (
            <button type="button" className={bouton + ' bg-white border-green-200 text-green-700'} onClick={() => archiver(true)} disabled={enCours}>
              Réactiver ({sel.reactivables.length})
            </button>
          )}
          <button type="button" className="ml-auto text-sm text-indigo-700 underline" onClick={toutDecocher}>Tout désélectionner</button>
        </div>
      )}
      {children}
    </div>
  )
}
