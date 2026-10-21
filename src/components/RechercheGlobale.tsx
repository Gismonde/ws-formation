'use client'
// Recherche globale de l'administration (en-tête). Raccourcis : Ctrl/⌘ + K ou « / ».
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n/client'
import type { ResultatRecherche } from '@/app/api/admin/recherche/route'

const ICONE: Record<ResultatRecherche['type'], string> = { employe: '👤', formation: '🎓', politique: '📜', journee: '📅', sop: '📋', librairie: '📚' }

export function RechercheGlobale() {
  const { t } = useT()
  const router = useRouter()
  const [q, setQ] = useState('')
  const [res, setRes] = useState<ResultatRecherche[]>([])
  const [ouvert, setOuvert] = useState(false)
  const [charge, setCharge] = useState(false)
  const [actif, setActif] = useState(0)
  const champ = useRef<HTMLInputElement>(null)
  const boite = useRef<HTMLDivElement>(null)

  const GROUPE: Record<ResultatRecherche['type'], string> = {
    employe: t('Employés'), formation: t('Formations'), politique: t('Politiques'),
    journee: t('Journées de formation'), sop: t('Procédures (SOP)'), librairie: t('Librairie'),
  }
  const ETAT: Record<NonNullable<ResultatRecherche['etat']>, string> = {
    archive: t('archivé'), publiee: t('publiée'), brouillon: t('brouillon'), modele: t('modèle'),
  }

  useEffect(() => {
    const raccourci = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement
      const saisie = cible?.closest('input, textarea, select, [contenteditable="true"]')
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !saisie)) {
        e.preventDefault(); champ.current?.focus(); setOuvert(true)
      }
    }
    const dehors = (e: MouseEvent) => { if (boite.current && !boite.current.contains(e.target as Node)) setOuvert(false) }
    window.addEventListener('keydown', raccourci)
    document.addEventListener('mousedown', dehors)
    return () => { window.removeEventListener('keydown', raccourci); document.removeEventListener('mousedown', dehors) }
  }, [])

  useEffect(() => {
    const texte = q.trim()
    if (texte.length < 2) { setRes([]); setCharge(false); return }
    setCharge(true)
    const ctrl = new AbortController()
    const minuterie = setTimeout(async () => {
      try {
        const r = await fetch('/api/admin/recherche?q=' + encodeURIComponent(texte), { signal: ctrl.signal })
        const d = await r.json()
        setRes(d.resultats ?? []); setActif(0)
      } catch { /* requête annulée */ }
      setCharge(false)
    }, 250)
    return () => { clearTimeout(minuterie); ctrl.abort() }
  }, [q])

  const aller = (r: ResultatRecherche) => { setOuvert(false); setQ(''); router.push(r.href) }

  const clavier = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOuvert(false); champ.current?.blur() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActif(a => Math.min(a + 1, res.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActif(a => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter' && res[actif]) { e.preventDefault(); aller(res[actif]) }
  }

  const types = Array.from(new Set(res.map(r => r.type)))
  return (
    <div ref={boite} className="relative w-full max-w-md">
      <input
        ref={champ} value={q} onChange={e => { setQ(e.target.value); setOuvert(true) }} onFocus={() => setOuvert(true)} onKeyDown={clavier}
        placeholder={t('Rechercher un employé, une formation, une politique…')} aria-label={t('Recherche globale')}
        className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-14 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
      <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-gray-200 bg-white px-1.5 text-[10px] text-gray-400">Ctrl K</kbd>
      {ouvert && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full mt-2 max-h-[70vh] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl z-50">
          {charge && res.length === 0 && <p className="p-4 text-sm text-gray-400">{t('Recherche…')}</p>}
          {!charge && res.length === 0 && <p className="p-4 text-sm text-gray-500">{t('Aucun résultat pour « {q} ».', { q: q.trim() })}</p>}
          {types.map(type => (
            <div key={type} className="py-1">
              <div className="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{GROUPE[type]}</div>
              {res.filter(r => r.type === type).map(r => {
                const i = res.indexOf(r)
                return (
                  <button key={r.type + r.id} type="button" onMouseEnter={() => setActif(i)} onClick={() => aller(r)}
                    className={'flex w-full items-start gap-3 px-4 py-2 text-left ' + (i === actif ? 'bg-indigo-50' : 'hover:bg-gray-50')}>
                    <span aria-hidden>{ICONE[r.type]}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-gray-900">{r.titre}</span>
                      <span className="block truncate text-xs text-gray-500">{[r.detail, r.etat ? ETAT[r.etat] : ''].filter(Boolean).join(' · ')}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
