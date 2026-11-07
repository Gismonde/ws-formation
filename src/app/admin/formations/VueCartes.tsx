'use client'
// Vue détaillée des formations : filtres (recherche, catégorie, mot-clé, versions FR/EN), sections repliables
// par catégorie, publiées d'abord puis brouillons, cartes de hauteur uniforme.
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useT } from '@/lib/i18n/client'
import SectionRepliable from '@/components/SectionRepliable'
import ToutReplier from '@/components/politiques/ToutReplier'
import { couleurCategorie } from '@/lib/politiques-categories'
import { CLINIQUE_INFO, type CliniqueContenu } from '@/lib/cliniques'

export type CarteFormation = {
  id: string; titre: string; description: string | null; categorie: string; niveau: string | null
  obligatoire: boolean; clinique: CliniqueContenu; publiee: boolean; statut_validation: string | null
  image: string | null; modules: number; assignations: number; duree: number | null; tags: string[]
  copie: boolean; en: { id: string; titre: string; publiee: boolean; ecarts: number; fr_apres: boolean } | null
}

const NIVEAUX: Record<string, { bg: string; color: string; label: string }> = {
  debutant: { bg: '#f0fdf4', color: '#16a34a', label: 'Débutant' },
  intermediaire: { bg: '#fefce8', color: '#ca8a04', label: 'Intermédiaire' },
  avance: { bg: '#fff1f2', color: '#e11d48', label: 'Avancé' },
}

const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function BadgeClinique({ c }: { c: CliniqueContenu }) {
  if (c === 'LES_DEUX') return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-700">CMC + WSSC</span>
  return <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: CLINIQUE_INFO[c].fond, color: CLINIQUE_INFO[c].couleur, border: `1px solid ${CLINIQUE_INFO[c].couleur}33` }}>{CLINIQUE_INFO[c].court}</span>
}

export function BadgeVersions({ en, t }: { en: CarteFormation['en']; t: (s: string, v?: Record<string, string | number>) => string }) {
  if (!en) return null
  const alerte = en.ecarts > 0 || en.fr_apres
  const titre = en.titre + (en.ecarts > 0 ? ' — ' + t('{n} écart(s) de structure FR/EN', { n: en.ecarts }) : '') + (en.fr_apres ? ' — ' + t('Version française modifiée après la version anglaise') : '')
  return (
    <Link href={`/admin/formations/${en.id}`} title={titre} className={'rounded-full px-2 py-0.5 text-[11px] font-bold no-underline ' + (alerte ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800')}>
      FR · EN{alerte ? ' ⚠' : ''}{en.publiee ? '' : ' (' + t('brouillon') + ')'}
    </Link>
  )
}

export default function VueCartes({ formations, statutInitial = '' }: { formations: CarteFormation[]; statutInitial?: '' | 'publiee' | 'brouillon' }) {
  const { t } = useT()
  const [q, setQ] = useState('')
  const [categorie, setCategorie] = useState('')
  const [motCle, setMotCle] = useState('')
  const [versions, setVersions] = useState<'' | 'fr_en' | 'fr' | 'ecart'>('')
  const [statut, setStatut] = useState<'' | 'publiee' | 'brouillon'>(statutInitial)
  useEffect(() => { setStatut(statutInitial) }, [statutInitial])
  // Rangement : par catégorie, ou tout ensemble (une seule grille, comme avant). Choix mémorisé dans ce navigateur.
  const [rangement, setRangement] = useState<'categories' | 'ensemble'>('categories')
  useEffect(() => { try { if (localStorage.getItem('ws_rangement_formations') === 'ensemble') setRangement('ensemble') } catch { /* stockage indisponible */ } }, [])
  const choisirRangement = (r: 'categories' | 'ensemble') => { setRangement(r); try { localStorage.setItem('ws_rangement_formations', r) } catch { /* stockage indisponible */ } }

  const categories = useMemo(() => Array.from(new Set(formations.map(f => f.categorie))).sort((a, b) => (a ? 0 : 1) - (b ? 0 : 1) || a.localeCompare(b, 'fr')), [formations])
  const motsCles = useMemo(() => Array.from(new Set(formations.flatMap(f => f.tags))).sort((a, b) => a.localeCompare(b, 'fr')), [formations])

  const filtrees = formations.filter(f => {
    if (categorie && f.categorie !== (categorie === '—' ? '' : categorie)) return false
    if (motCle && !f.tags.includes(motCle)) return false
    if (versions === 'fr_en' && !f.en) return false
    if (versions === 'fr' && f.en) return false
    if (versions === 'ecart' && !(f.en && (f.en.ecarts > 0 || f.en.fr_apres))) return false
    if (q.trim()) {
      const texte = sansAccents([f.titre, f.description ?? '', f.categorie, ...f.tags, f.en?.titre ?? ''].join(' '))
      if (!sansAccents(q).trim().split(/\s+/).every(m => texte.includes(m))) return false
    }
    return true
  })
  const groupes = categories.map(nom => ({
    nom,
    liste: filtrees.filter(f => f.categorie === nom).sort((a, b) => (a.publiee === b.publiee ? 0 : a.publiee ? -1 : 1) || a.titre.localeCompare(b.titre, 'fr')),
  })).filter(g => g.liste.length)
  const actifs = !!(q || categorie || motCle || versions || statut)
  const champ = 'rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm !w-auto flex-none max-w-[230px]'

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3">
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={t('Rechercher : titre, description, mot-clé…')} aria-label={t('Rechercher une formation')} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm min-w-[220px] flex-1" />
        <select value={categorie} onChange={e => setCategorie(e.target.value)} aria-label={t('Catégorie')} className={champ}>
          <option value="">{t('Toutes les catégories')}</option>
          {categories.map(c => <option key={c || '—'} value={c || '—'}>{c || t('Sans catégorie')}</option>)}
        </select>
        {motsCles.length > 0 && (
          <select value={motCle} onChange={e => setMotCle(e.target.value)} aria-label={t('Mot-clé')} className={champ}>
            <option value="">{t('Tous les mots-clés')}</option>
            {motsCles.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
        <select value={statut} onChange={e => setStatut(e.target.value as typeof statut)} aria-label={t('Statut')} className={champ}>
          <option value="">{t('Publiées et brouillons')} ({formations.length})</option>
          <option value="publiee">{t('Publiées')} ({formations.filter(f => f.publiee).length})</option>
          <option value="brouillon">{t('Brouillons')} ({formations.filter(f => !f.publiee).length})</option>
        </select>
        <select value={versions} onChange={e => setVersions(e.target.value as typeof versions)} aria-label={t('Versions linguistiques')} className={champ}>
          <option value="">{t('Toutes les versions')}</option>
          <option value="fr_en">{t('Français et anglais')}</option>
          <option value="fr">{t('Français seulement')}</option>
          <option value="ecart">⚠ {t('Écart FR/EN à vérifier')}</option>
        </select>
        {actifs && <button type="button" onClick={() => { setQ(''); setCategorie(''); setMotCle(''); setVersions(''); setStatut('') }} className="text-sm text-indigo-700 hover:underline">{t('Effacer les filtres')}</button>}
        <span className="ml-auto flex flex-none flex-wrap items-center gap-2">
          <span role="group" aria-label={t('Rangement')} className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-xs font-semibold">
            {([['categories', t('Par catégorie')], ['ensemble', t('Tout ensemble')]] as const).map(([v, l]) => (
              <button key={v} type="button" aria-pressed={rangement === v} onClick={() => choisirRangement(v)} className={'rounded-md px-3 py-1.5 ' + (rangement === v ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50')}>{l}</button>
            ))}
          </span>
          {rangement === 'categories' && <ToutReplier />}
        </span>
      </div>
      {actifs && <p className="mb-3 text-sm text-gray-500">{t('{n} formation(s) correspondent', { n: filtrees.length })}</p>}

      {filtrees.length > 0 && rangement === 'ensemble' ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
          {filtrees.map(f => <Carte key={f.id} f={f} />)}
        </div>
      ) : groupes.length === 0 ? (
        <p className="rounded-2xl border border-gray-200 bg-white p-12 text-center text-gray-400">{formations.length ? t('Aucune formation ne correspond à ces filtres.') : t('Aucune formation pour le moment.')}</p>
      ) : groupes.map(g => (
        <SectionRepliable key={g.nom || '—'} couleur={g.nom ? couleurCategorie(g.nom) : '#9ca3af'} icone="📚" titre={g.nom || t('Sans catégorie')}
          sousTitre={t('{n} formation(s)', { n: g.liste.length })}
          detail={<span className="text-gray-500">{t('{p} publiée(s) · {b} brouillon(s)', { p: g.liste.filter(f => f.publiee).length, b: g.liste.filter(f => !f.publiee).length })}</span>}>
          <div className="grid gap-4 p-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
            {g.liste.map(f => <Carte key={f.id} f={f} />)}
          </div>
        </SectionRepliable>
      ))}
    </div>
  )
}

function Carte({ f }: { f: CarteFormation }) {
  const { t } = useT()
  const niv = f.niveau ? NIVEAUX[f.niveau] : null
  const val = f.statut_validation && f.statut_validation !== 'brouillon' && !(f.publiee && f.statut_validation === 'approuvee') ? f.statut_validation : null
  return (
    <div className={'flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm ' + (f.publiee ? 'border-gray-200' : 'border-dashed border-gray-300')}>
      <Link href={`/admin/formations/${f.id}`} className="relative block aspect-video" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
        {f.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={f.image} alt="" loading="lazy" className="block h-full w-full object-cover" />
        ) : <span className="absolute inset-0 flex items-center justify-center text-4xl">📚</span>}
        <span className="absolute left-2 top-2"><BadgeClinique c={f.clinique} /></span>
        <span className={'absolute right-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-bold text-white ' + (f.publiee ? 'bg-green-600' : 'bg-gray-900/75')}>{f.publiee ? t('Publiée') : t('Brouillon')}</span>
        {val && (
          <span className={'absolute bottom-2 right-2 rounded-full px-2 py-0.5 text-[11px] font-bold ' + (val === 'approuvee' ? 'bg-green-100 text-green-800' : val === 'a_modifier' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800')}>
            {val === 'approuvee' ? t('Approuvée') : val === 'a_modifier' ? t('Modifications demandées') : t('En validation')}
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex h-5 items-center gap-1.5 overflow-hidden whitespace-nowrap">
          {niv && <span className="rounded-full px-2 py-px text-[11px] font-semibold" style={{ background: niv.bg, color: niv.color }}>{t(niv.label)}</span>}
          {f.obligatoire && <span className="text-[10px] font-extrabold uppercase text-red-600">{t('Obligatoire LSST')}</span>}
          <BadgeVersions en={f.en} t={t} />
        </div>
        <Link href={`/admin/formations/${f.id}`} title={f.titre} className="line-clamp-2 h-[2.6em] overflow-hidden text-[15px] font-bold leading-[1.3em] text-gray-900 no-underline">{f.titre}</Link>
        <p title={f.description ?? undefined} className="!m-0 line-clamp-2 h-[2.7em] overflow-hidden text-[13px] leading-[1.35em] text-gray-500">{f.description ?? ''}</p>
        {f.copie && <span className="self-start rounded-full bg-violet-100 px-2 py-px text-[11px] font-bold text-violet-700">✏️ {t('Copie de travail en cours')}</span>}
        <div className="mt-auto truncate pt-1 text-xs text-gray-500" title={t('Modules · assignations · durée')}>
          📦 {f.modules} module(s) · 👥 {f.assignations}{f.duree ? ` · ⏱ ${f.duree < 60 ? `${f.duree} min` : `${Math.round(f.duree / 6) / 10} h`}` : ''}
        </div>
        <div className="flex gap-1.5 text-xs">
          <Link href={`/admin/formations/${f.id}`} className="flex-1 rounded-md bg-gray-100 py-1.5 text-center font-semibold text-gray-700 no-underline hover:bg-gray-200">{t('Gérer')}</Link>
          <Link href={`/admin/assigner?formations=${f.id}`} className="flex-1 rounded-md bg-indigo-50 py-1.5 text-center font-semibold text-indigo-700 no-underline hover:bg-indigo-100">{t('Assigner')}</Link>
        </div>
      </div>
    </div>
  )
}
