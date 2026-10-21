'use client'

// Éditeur visuel des blocs d'une leçon :
//  - bouton « + » entre les blocs, menu illustré
//  - modification sur place avec sauvegarde automatique
//  - glisser-déposer pour réordonner
//  - images : glisser un fichier, choisir, ou coller une capture (Ctrl+V)
//  - vidéos : lien YouTube/Vimeo reconnu automatiquement, ou envoi d'un fichier
//  - quiz construit à la souris

import { useT } from '@/lib/i18n/client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import {
  createContentBlock, updateContentBlock, deleteContentBlock, reorderContentBlocks, getLessonWithBlocks,
} from '@/lib/actions/lessons'
import type { ContentBlock, ContentBlockType } from '@/lib/types/formation'
import { analyserVideoEnLigne, estMediaPrive, REGLES_MEDIAS, GenreMedia } from '@/lib/medias'
import { envoyerMedia } from '@/lib/medias-client'
import ChoixLibrairie, { blocPourChoix, type ElementChoisi } from './ChoixLibrairie'
import { lireQuiz, nouvelleQuestion, Quiz } from '@/lib/quiz'
import { STYLES_ENCADRE } from '@/lib/texte-riche'
import { MODELES_LECON, ModeleLecon } from '@/lib/modeles-lecon'

type Bloc = ContentBlock
type EtatSauvegarde = 'ok' | 'en_cours' | 'erreur'

const TYPES_MENU: { type: ContentBlockType; style?: string; icone: string; libelle: string; aide: string }[] = [
  { type: 'text', icone: '📝', libelle: 'Texte', aide: 'Paragraphes, listes, gras' },
  { type: 'image', icone: '🖼️', libelle: 'Image', aide: 'Glisser, choisir ou coller' },
  { type: 'video', icone: '🎬', libelle: 'Vidéo', aide: 'YouTube, Vimeo ou fichier' },
  { type: 'quiz', icone: '❓', libelle: 'Quiz', aide: 'Questions à choix' },
  { type: 'text', style: 'a_retenir', icone: '💡', libelle: 'À retenir', aide: 'Encadré bleu' },
  { type: 'text', style: 'attention', icone: '⚠️', libelle: 'Attention', aide: 'Encadré orange' },
  { type: 'text', style: 'procedure', icone: '✅', libelle: 'Procédure', aide: 'Étapes numérotées' },
  { type: 'file', icone: '📎', libelle: 'Document', aide: 'PDF, Word, Excel…' },
]

const LIBELLE_TYPE: Record<string, string> = {
  text: 'Texte', image: 'Image', video: 'Vidéo', quiz: 'Quiz', file: 'Document', slide: 'Présentation',
}

const supabaseNavigateur = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function meta(b: Bloc): Record<string, unknown> {
  return (b.metadata && typeof b.metadata === 'object') ? b.metadata as Record<string, unknown> : {}
}

// ---------------------------------------------------------------------------

export default function EditeurBlocs({ leconId, formationId, blocsInitiaux, onModeleAttestation }: {
  leconId: string
  formationId: string
  blocsInitiaux: Bloc[]
  /** Un modèle demande « J'ai lu et compris » : la page active l'option de la leçon */
  onModeleAttestation?: () => void
}) {
  const { t } = useT()
  const [blocs, setBlocs] = useState<Bloc[]>(() => [...blocsInitiaux].sort((a, b) => a.ordre - b.ordre))
  const [etat, setEtat] = useState<EtatSauvegarde>('ok')
  const [erreur, setErreur] = useState<string | null>(null)
  const [menuOuvert, setMenuOuvert] = useState<number | null>(null)
  const [choixLibrairie, setChoixLibrairie] = useState<{ position: number } | { blocId: string } | null>(null)
  const [glisse, setGlisse] = useState<string | null>(null)
  const [survol, setSurvol] = useState<number | null>(null)
  const [urlsMedias, setUrlsMedias] = useState<Record<string, string>>({})
  const minuteries = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const enAttente = useRef<Record<string, Partial<Bloc>>>({})

  // À l'ouverture d'une leçon, on recharge ses blocs à jour depuis la base
  useEffect(() => {
    setMenuOuvert(null)
    let actif = true
    getLessonWithBlocks(leconId).then(res => {
      if (actif && res.success) {
        const frais = (res.data.blocs ?? []) as Bloc[]
        setBlocs([...frais].sort((a, b) => a.ordre - b.ordre))
      }
    })
    return () => { actif = false }
  }, [leconId])

  // Adresses temporaires pour afficher les médias privés
  const refsMedias = useMemo(() => blocs.map(b => b.url).filter(estMediaPrive), [blocs])
  useEffect(() => {
    const manquants = refsMedias.filter(r => !urlsMedias[r])
    if (manquants.length === 0) return
    const q = manquants.map(r => 'ref=' + encodeURIComponent(r)).join('&')
    fetch('/api/formations/medias?' + q).then(r => r.json()).then(d => {
      if (d.urls) setUrlsMedias(u => ({ ...u, ...d.urls }))
    }).catch(() => {})
  }, [refsMedias]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sauvegarde automatique (regroupée par bloc, 0,7 s après la dernière frappe)
  const enregistrer = useCallback(async (id: string) => {
    const changes = enAttente.current[id]
    delete enAttente.current[id]
    if (!changes) return
    setEtat('en_cours')
    const res = await updateContentBlock(id, changes as Parameters<typeof updateContentBlock>[1])
    if (res.success) setEtat(Object.keys(enAttente.current).length ? 'en_cours' : 'ok')
    else { setEtat('erreur'); setErreur(res.error) }
  }, [])

  const modifier = useCallback((id: string, changes: Partial<Bloc>, immediat = false) => {
    setBlocs(bs => bs.map(b => b.id === id ? { ...b, ...changes } : b))
    enAttente.current[id] = { ...enAttente.current[id], ...changes }
    setEtat('en_cours')
    clearTimeout(minuteries.current[id])
    if (immediat) enregistrer(id)
    else minuteries.current[id] = setTimeout(() => enregistrer(id), 700)
  }, [enregistrer])

  // Avant de quitter la page, on enregistre ce qui reste
  useEffect(() => {
    const avantDepart = (e: BeforeUnloadEvent) => {
      if (Object.keys(enAttente.current).length) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', avantDepart)
    const timers = minuteries.current
    return () => {
      window.removeEventListener('beforeunload', avantDepart)
      Object.keys(enAttente.current).forEach(id => { clearTimeout(timers[id]); enregistrer(id) })
    }
  }, [enregistrer])

  const renumeroter = useCallback(async (liste: Bloc[]) => {
    const numerotes = liste.map((b, i) => ({ ...b, ordre: i + 1 }))
    setBlocs(numerotes)
    setEtat('en_cours')
    const res = await reorderContentBlocks(leconId, numerotes.map(b => ({ id: b.id, ordre: b.ordre })))
    setEtat(res.success ? 'ok' : 'erreur')
    if (!res.success) setErreur(res.error)
  }, [leconId])

  const ajouter = useCallback(async (position: number, type: ContentBlockType, style?: string, valeurs: Partial<Bloc> = {}) => {
    setMenuOuvert(null)
    setEtat('en_cours')
    const contenuInitial = type === 'quiz' ? JSON.stringify({ questions: [nouvelleQuestion()] })
      : style === 'procedure' ? '1. ' : undefined
    const res = await createContentBlock({
      lesson_id: leconId,
      type,
      ordre: position + 1,
      contenu: (valeurs.contenu as string | undefined) ?? contenuInitial,
      url: (valeurs.url as string | undefined) ?? undefined,
      titre: (valeurs.titre as string | undefined) ?? (style ? STYLES_ENCADRE[style]?.libelle : undefined),
      metadata: style ? { style } : (valeurs.metadata as Record<string, unknown> | undefined) ?? null,
    })
    if (!res.success) { setEtat('erreur'); setErreur(res.error); return null }
    const nouveau = res.data
    const liste = [...blocs]
    liste.splice(position, 0, nouveau)
    await renumeroter(liste)
    return nouveau
  }, [blocs, leconId, renumeroter])

  const supprimer = useCallback(async (id: string) => {
    if (!confirm('Supprimer ce bloc ?')) return
    clearTimeout(minuteries.current[id]); delete enAttente.current[id]
    setEtat('en_cours')
    const res = await deleteContentBlock(id)
    if (!res.success) { setEtat('erreur'); setErreur(res.error); return }
    await renumeroter(blocs.filter(b => b.id !== id))
  }, [blocs, renumeroter])

  const dupliquer = useCallback(async (b: Bloc) => {
    const i = blocs.findIndex(x => x.id === b.id)
    await ajouter(i + 1, b.type, undefined, { titre: b.titre, contenu: b.contenu, url: b.url, metadata: b.metadata })
  }, [blocs, ajouter])

  const deplacer = useCallback((id: string, vers: number) => {
    const liste = [...blocs]
    const de = liste.findIndex(b => b.id === id)
    if (de < 0) return
    const [b] = liste.splice(de, 1)
    liste.splice(vers > de ? vers - 1 : vers, 0, b)
    renumeroter(liste)
  }, [blocs, renumeroter])

  // Coller une capture d'écran n'importe où dans l'éditeur (hors champ de texte) → nouveau bloc image
  useEffect(() => {
    const coller = async (e: ClipboardEvent) => {
      const cible = e.target as HTMLElement | null
      if (cible && (cible.tagName === 'TEXTAREA' || cible.tagName === 'INPUT') && !cible.dataset.zoneImage) return
      const fichier = Array.from(e.clipboardData?.files ?? []).find(f => f.type.startsWith('image/'))
      if (!fichier || cible?.dataset.zoneImage) return
      e.preventDefault()
      try {
        setEtat('en_cours')
        const ref = await envoyerMedia(fichier, 'image')
        await ajouter(blocs.length, 'image', undefined, { url: ref })
      } catch (err) { setEtat('erreur'); setErreur((err as Error).message) }
    }
    window.addEventListener('paste', coller)
    return () => window.removeEventListener('paste', coller)
  }, [ajouter, blocs.length])

  const props = { modifier, urlsMedias, setErreur, setEtat, ouvrirLibrairie: (blocId: string) => setChoixLibrairie({ blocId }) }

  // Élément de la librairie → bloc lié (vidéo intégrée si YouTube/Vimeo/fichier, sinon lien vers le document)
  const depuisLibrairie = (e: ElementChoisi) => {
    const { type, metadata } = blocPourChoix(e)
    const cible = choixLibrairie
    setChoixLibrairie(null)
    if (!cible) return
    if ('position' in cible) {
      ajouter(cible.position, type, undefined, { titre: e.titre, url: e.url, metadata })
    } else {
      const bloc = blocs.find(b => b.id === cible.blocId)
      if (!bloc) return
      if (bloc.type !== type) { setErreur(type === 'file' ? 'Cette vidéo ne peut pas être intégrée (lien SharePoint) : ajoutez-la comme bloc « Librairie » pour l’afficher en lien.' : t('Choisissez un document ou un lien pour ce bloc.')); return }
      modifier(bloc.id, { url: e.url, contenu: null, titre: bloc.titre || e.titre, metadata: { ...meta(bloc), ...metadata } }, true)
    }
  }

  // Partir d'un modèle : crée tous les blocs du modèle d'un coup
  const appliquerModele = async (modele: ModeleLecon) => {
    setEtat('en_cours')
    const crees: Bloc[] = []
    for (let i = 0; i < modele.blocs.length; i++) {
      const b = modele.blocs[i]
      const res = await createContentBlock({
        lesson_id: leconId, type: b.type, ordre: i + 1,
        titre: b.titre, contenu: b.contenu, metadata: b.metadata ?? null,
      })
      if (!res.success) { setEtat('erreur'); setErreur(res.error); break }
      crees.push(res.data)
    }
    setBlocs(crees)
    setEtat('ok')
    if (modele.attestation) onModeleAttestation?.()
  }

  return (
    <div>
      {choixLibrairie && (
        <ChoixLibrairie
          types={'blocId' in choixLibrairie
            ? (blocs.find(b => b.id === choixLibrairie.blocId)?.type === 'video' ? ['video'] : ['document', 'lien', 'politique'])
            : ['video', 'lien', 'document', 'politique']}
          onChoisir={depuisLibrairie} onFermer={() => setChoixLibrairie(null)} />
      )}
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          {t('Contenu de la leçon')} <span className="text-gray-400 font-normal normal-case">({blocs.length} bloc{blocs.length > 1 ? 's' : ''})</span>
        </h3>
        <div className="flex items-center gap-3">
          <span className={'text-xs ' + (etat === 'erreur' ? 'text-red-600' : etat === 'en_cours' ? 'text-amber-600' : 'text-green-600')}>
            {etat === 'erreur' ? t('⚠️ Erreur d’enregistrement') : etat === 'en_cours' ? t('Enregistrement…') : t('✓ Enregistré')}
          </span>
          <a href={`/formations/${formationId}/lecon/${leconId}?apercu=1`} target="_blank" rel="noopener noreferrer"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50">
            {t('👁️ Aperçu employé')}
          </a>
        </div>
      </div>

      {erreur && (
        <div className="mb-3 text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 flex justify-between gap-2">
          <span>{erreur}</span>
          <button onClick={() => setErreur(null)} className="text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      <p className="text-xs text-gray-400 mb-3">
        Astuce : collez une capture d’écran (Ctrl+V) pour l’ajouter en image. Glissez les blocs par la poignée ⋮⋮ pour les réordonner.
      </p>

      {blocs.length === 0 && (
        <div className="mb-4">
          <p className="text-sm font-semibold text-gray-700 mb-2">{t('Partir d’un modèle')}</p>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
            {MODELES_LECON.map(m => (
              <button key={m.id} onClick={() => appliquerModele(m)} disabled={etat === 'en_cours'}
                className="text-left p-3 rounded-xl border border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50">
                <span className="text-xl">{m.icone}</span>
                <span className="block text-sm font-semibold text-gray-800 mt-1">{m.nom}</span>
                <span className="block text-xs text-gray-500">{m.description}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">{t('…ou commencez avec un bloc vide :')}</p>
        </div>
      )}

      <ZoneInsertion index={0} ouvert={menuOuvert === 0} setOuvert={setMenuOuvert} onChoisir={ajouter} onLibrairie={p => { setMenuOuvert(null); setChoixLibrairie({ position: p }) }}
        actif={glisse !== null && survol === 0} onDragOver={() => setSurvol(0)} onDrop={() => glisse && deplacer(glisse, 0)} vide={blocs.length === 0} />

      {blocs.map((b, i) => (
        <div key={b.id}>
          <div
            className={'bg-white rounded-xl border shadow-sm transition-opacity ' + (glisse === b.id ? 'opacity-40 border-blue-300' : 'border-gray-200')}
          >
            <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50 rounded-t-xl">
              <span
                draggable
                onDragStart={e => { setGlisse(b.id); e.dataTransfer.effectAllowed = 'move' }}
                onDragEnd={() => { setGlisse(null); setSurvol(null) }}
                title={t('Glisser pour déplacer')}
                className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 select-none px-1"
              >⋮⋮</span>
              <span className="text-xs font-semibold text-gray-500 uppercase">
                {b.type === 'text' && meta(b).style && meta(b).style !== 'normal'
                  ? STYLES_ENCADRE[String(meta(b).style)]?.libelle ?? 'Texte'
                  : LIBELLE_TYPE[b.type] ?? b.type}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <BoutonIcone titre="Monter" disabled={i === 0} onClick={() => deplacer(b.id, i - 1)}>↑</BoutonIcone>
                <BoutonIcone titre="Descendre" disabled={i === blocs.length - 1} onClick={() => deplacer(b.id, i + 2)}>↓</BoutonIcone>
                <BoutonIcone titre="Dupliquer" onClick={() => dupliquer(b)}>⧉</BoutonIcone>
                <BoutonIcone titre="Supprimer" danger onClick={() => supprimer(b.id)}>✕</BoutonIcone>
              </div>
            </div>
            <div className="p-4">
              {b.type === 'text' && <EditeurTexte bloc={b} {...props} />}
              {b.type === 'image' && <EditeurImage bloc={b} {...props} />}
              {b.type === 'video' && <EditeurVideo bloc={b} {...props} />}
              {b.type === 'quiz' && <EditeurQuiz bloc={b} {...props} />}
              {b.type === 'file' && <EditeurFichier bloc={b} {...props} />}
              {b.type === 'slide' && <EditeurLien bloc={b} {...props} />}
            </div>
          </div>
          <ZoneInsertion index={i + 1} ouvert={menuOuvert === i + 1} setOuvert={setMenuOuvert} onChoisir={ajouter} onLibrairie={p => { setMenuOuvert(null); setChoixLibrairie({ position: p }) }}
            actif={glisse !== null && survol === i + 1} onDragOver={() => setSurvol(i + 1)} onDrop={() => glisse && deplacer(glisse, i + 1)} />
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Insertion

function ZoneInsertion({ index, ouvert, setOuvert, onChoisir, onLibrairie, actif, onDragOver, onDrop, vide }: {
  index: number
  onLibrairie: (position: number) => void
  ouvert: boolean
  setOuvert: (i: number | null) => void
  onChoisir: (position: number, type: ContentBlockType, style?: string) => void
  actif: boolean
  onDragOver: () => void
  onDrop: () => void
  vide?: boolean
}) {
  const { t } = useT()
  return (
    <div
      onDragOver={e => { e.preventDefault(); onDragOver() }}
      onDrop={e => { e.preventDefault(); onDrop() }}
      className={'relative py-2 ' + (actif ? 'py-4' : '')}
    >
      {actif && <div className="h-1 rounded bg-blue-500" />}
      {!actif && (
        <div className="flex items-center gap-2 group">
          <div className="flex-1 h-px bg-transparent group-hover:bg-gray-200" />
          <button
            onClick={() => setOuvert(ouvert ? null : index)}
            className={vide
              ? 'px-4 py-3 rounded-xl border-2 border-dashed border-blue-300 text-blue-600 text-sm font-semibold hover:bg-blue-50 w-full'
              : 'w-7 h-7 rounded-full border border-gray-300 bg-white text-gray-500 hover:bg-blue-600 hover:text-white hover:border-blue-600 text-lg leading-none shadow-sm'}
            title={t('Ajouter un bloc ici')}
          >
            {vide ? t('+ Ajouter le premier bloc') : '+'}
          </button>
          <div className="flex-1 h-px bg-transparent group-hover:bg-gray-200" />
        </div>
      )}
      {ouvert && (
        <div className="mt-2 grid gap-2 bg-white border border-gray-200 rounded-xl p-3 shadow-lg" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
          {TYPES_MENU.map(t => (
            <button key={t.libelle} onClick={() => onChoisir(index, t.type, t.style)}
              className="flex flex-col items-start gap-0.5 p-3 rounded-lg border border-gray-100 hover:border-blue-300 hover:bg-blue-50 text-left">
              <span className="text-xl">{t.icone}</span>
              <span className="text-sm font-semibold text-gray-800">{t.libelle}</span>
              <span className="text-xs text-gray-500">{t.aide}</span>
            </button>
          ))}
          <button onClick={() => onLibrairie(index)}
            className="flex flex-col items-start gap-0.5 p-3 rounded-lg border border-indigo-200 bg-indigo-50/50 hover:border-indigo-400 hover:bg-indigo-50 text-left">
            <span className="text-xl">📚</span>
            <span className="text-sm font-semibold text-gray-800">{t('Librairie')}</span>
            <span className="text-xs text-gray-500">{t('Vidéo, lien, document ou politique')}</span>
          </button>
        </div>
      )}
    </div>
  )
}

function BoutonIcone({ children, titre, onClick, disabled, danger }: {
  children: React.ReactNode; titre: string; onClick: () => void; disabled?: boolean; danger?: boolean
}) {
  return (
    <button title={titre} aria-label={titre} onClick={onClick} disabled={disabled}
      className={'w-7 h-7 rounded-md text-sm disabled:opacity-30 ' + (danger ? 'text-red-400 hover:bg-red-50 hover:text-red-600' : 'text-gray-500 hover:bg-gray-200')}>
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Éditeurs par type

type PropsBloc = {
  bloc: Bloc
  ouvrirLibrairie: (blocId: string) => void
  modifier: (id: string, changes: Partial<Bloc>, immediat?: boolean) => void
  urlsMedias: Record<string, string>
  setErreur: (e: string | null) => void
  setEtat: (e: EtatSauvegarde) => void
}

const champ = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

function ZoneTexteAuto(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { t } = useT()
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const t = ref.current
    if (t) { t.style.height = 'auto'; t.style.height = t.scrollHeight + 2 + 'px' }
  }, [props.value])
  return <textarea ref={ref} rows={3} {...props} className={champ + ' resize-none leading-relaxed ' + (props.className ?? '')} />
}

function EditeurTexte({ bloc, modifier }: PropsBloc) {
  const { t } = useT()
  const style = String(meta(bloc).style ?? 'normal')
  const s = STYLES_ENCADRE[style] ?? STYLES_ENCADRE.normal
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {Object.entries(STYLES_ENCADRE).map(([cle, st]) => (
          <button key={cle} onClick={() => modifier(bloc.id, { metadata: { ...meta(bloc), style: cle } }, true)}
            className={'text-xs px-2 py-1 rounded-md border ' + (style === cle ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}>
            {st.icone} {st.libelle}
          </button>
        ))}
      </div>
      <div className="rounded-lg p-3" style={{ background: s.fond, border: `1px solid ${s.bord}` }}>
        {style !== 'normal' && (
          <input value={bloc.titre ?? ''} onChange={e => modifier(bloc.id, { titre: e.target.value })}
            placeholder={t('Titre de l\'encadré')} className="w-full bg-transparent font-semibold text-sm mb-2 focus:outline-none" style={{ color: s.titre }} />
        )}
        {style === 'normal' && (
          <input value={bloc.titre ?? ''} onChange={e => modifier(bloc.id, { titre: e.target.value || null })}
            placeholder={t('Sous-titre (optionnel)')} className="w-full bg-transparent font-semibold text-base text-gray-900 mb-2 focus:outline-none" />
        )}
        <ZoneTexteAuto value={bloc.contenu ?? ''} onChange={e => modifier(bloc.id, { contenu: e.target.value })}
          placeholder={style === 'procedure' ? '1. Première étape\n2. Deuxième étape' : 'Écrivez ici… (**gras**, *italique*, « - » pour une liste, « 1. » pour une liste numérotée)'}
          className="bg-white/70" />
      </div>
    </div>
  )
}

function ZoneDepot({ genre, onFichier, texte, enCours }: {
  genre: GenreMedia; onFichier: (f: File) => void; texte: string; enCours: boolean
}) {
  const { t } = useT()
  const [dessus, setDessus] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  return (
    <div
      tabIndex={0}
      data-zone-image={genre === 'image' ? '1' : undefined}
      onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDessus(true) } }}
      onDragLeave={() => setDessus(false)}
      onDrop={e => {
        const f = e.dataTransfer.files?.[0]
        if (f) { e.preventDefault(); e.stopPropagation(); setDessus(false); onFichier(f) }
      }}
      onPaste={e => {
        const f = Array.from(e.clipboardData.files).find(x => REGLES_MEDIAS[genre].types.includes(x.type))
        if (f) { e.preventDefault(); onFichier(f) }
      }}
      onClick={() => input.current?.click()}
      className={'rounded-xl border-2 border-dashed p-6 text-center cursor-pointer outline-none focus:ring-2 focus:ring-blue-400 ' +
        (dessus ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50')}
    >
      <input ref={input} type="file" hidden accept={REGLES_MEDIAS[genre].types.join(',')}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFichier(f); e.target.value = '' }} />
      {enCours ? (
        <p className="text-sm text-blue-700 font-medium">{t('Envoi en cours…')}</p>
      ) : (
        <>
          <p className="text-sm text-gray-700 font-medium">{texte}</p>
          <p className="text-xs text-gray-400 mt-1">{REGLES_MEDIAS[genre].libelle}</p>
        </>
      )}
    </div>
  )
}

function useEnvoi({ bloc, modifier, setErreur, setEtat }: PropsBloc, genre: GenreMedia) {
  const [enCours, setEnCours] = useState(false)
  const envoyer = async (f: File, autres: Partial<Bloc> = {}) => {
    setEnCours(true); setEtat('en_cours')
    try {
      const ref = await envoyerMedia(f, genre)
      modifier(bloc.id, { url: ref, ...autres }, true)
    } catch (e) { setErreur((e as Error).message); setEtat('erreur') }
    finally { setEnCours(false) }
  }
  return { enCours, envoyer }
}

function adresse(url: string | null, urlsMedias: Record<string, string>) {
  if (!url) return null
  return estMediaPrive(url) ? urlsMedias[url] ?? null : url
}

function EditeurImage(p: PropsBloc) {
  const { t } = useT()
  const { bloc, modifier, urlsMedias } = p
  const { enCours, envoyer } = useEnvoi(p, 'image')
  const src = adresse(bloc.url ?? bloc.contenu, urlsMedias)
  return (
    <div className="space-y-3">
      {bloc.url || bloc.contenu ? (
        <div className="relative group">
          {src
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={src} alt={String(meta(bloc).alt ?? bloc.titre ?? '')} className="w-full max-h-80 object-contain rounded-lg bg-gray-50" />
            : <div className="h-40 rounded-lg bg-gray-100 animate-pulse" />}
          <button onClick={() => modifier(bloc.id, { url: null, contenu: null }, true)}
            className="absolute top-2 right-2 text-xs bg-white/90 border border-gray-300 rounded-md px-2 py-1 opacity-0 group-hover:opacity-100">
            {t('Remplacer')}
          </button>
        </div>
      ) : (
        <ZoneDepot genre="image" enCours={enCours} onFichier={f => envoyer(f)}
          texte={t('Glissez une image ici, cliquez pour choisir, ou collez une capture (Ctrl+V)')} />
      )}
      <input value={bloc.titre ?? ''} onChange={e => modifier(bloc.id, { titre: e.target.value || null })}
        placeholder={t('Légende (affichée sous l\'image)')} className={champ} />
      <input value={String(meta(bloc).alt ?? '')} onChange={e => modifier(bloc.id, { metadata: { ...meta(bloc), alt: e.target.value } })}
        placeholder={t('Description pour l\'accessibilité (lecteurs d\'écran)')} className={champ + ' text-xs'} />
    </div>
  )
}

/** Bandeau d'un bloc lié à la librairie. */
function LienLibrairie({ bloc, modifier }: PropsBloc) {
  const { t } = useT()
  if (!meta(bloc).librairie_id) return null
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs bg-indigo-50 border border-indigo-100 text-indigo-800 rounded-lg px-3 py-2">
      <span>{t('📚 Lié à la librairie : se met à jour si l’élément y est modifié.')}</span>
      <button type="button" className="ml-auto underline" onClick={() => {
        const m = { ...meta(bloc) }; delete m.librairie_id
        modifier(bloc.id, { metadata: m }, true)
      }}>{t('Détacher')}</button>
    </div>
  )
}

function EditeurVideo(p: PropsBloc) {
  const { t } = useT()
  const { bloc, modifier, urlsMedias } = p
  const { enCours, envoyer } = useEnvoi(p, 'video')
  const source = bloc.url ?? bloc.contenu ?? ''
  const enLigne = source && !estMediaPrive(source) ? analyserVideoEnLigne(source) : null
  const [mode, setMode] = useState<'lien' | 'fichier'>(estMediaPrive(source) ? 'fichier' : 'lien')
  const src = estMediaPrive(source) ? urlsMedias[source] : null

  return (
    <div className="space-y-3">
      <input value={bloc.titre ?? ''} onChange={e => modifier(bloc.id, { titre: e.target.value || null })}
        placeholder={t('Titre de la vidéo')} className={champ + ' font-medium'} />
      <LienLibrairie {...p} />

      {source ? (
        <div className="space-y-2">
          <div className="aspect-video rounded-lg overflow-hidden bg-black">
            {enLigne ? (
              <iframe src={enLigne.embed} className="w-full h-full" allowFullScreen title={bloc.titre ?? 'Vidéo'}
                allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" />
            ) : src ? (
              <video src={src} controls className="w-full h-full" />
            ) : estMediaPrive(source) ? (
              <div className="w-full h-full animate-pulse bg-gray-800" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-gray-300 p-4 text-center">
                {t('Lien non reconnu. Collez un lien YouTube ou Vimeo, ou envoyez un fichier vidéo.')}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{enLigne ? (enLigne.plateforme === 'youtube' ? '▶ YouTube' : '▶ Vimeo') : estMediaPrive(source) ? t('🔒 Vidéo privée hébergée') : ''}</span>
            <button onClick={() => { const m = { ...meta(bloc) }; delete m.librairie_id; modifier(bloc.id, { url: null, contenu: null, metadata: m }, true) }} className="text-blue-600 hover:underline">{t('Changer de vidéo')}</button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex gap-1 text-xs">
            {(['lien', 'fichier'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={'px-3 py-1.5 rounded-md border ' + (mode === m ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600')}>
                {m === 'lien' ? '🔗 Lien YouTube / Vimeo' : t('⬆️ Envoyer un fichier')}
              </button>
            ))}
          </div>
          {mode === 'lien' ? (
            <input autoFocus placeholder={t('Collez le lien de la vidéo (ex. https://youtu.be/…)')} className={champ}
              onChange={e => { const v = e.target.value.trim(); if (analyserVideoEnLigne(v)) modifier(bloc.id, { url: v, contenu: null }, true) }} />
          ) : (
            <ZoneDepot genre="video" enCours={enCours} onFichier={f => envoyer(f, { contenu: null })}
              texte="Glissez une vidéo ici ou cliquez pour choisir (reste privée, visible seulement dans WS Formation)" />
          )}
          <p className="text-xs text-gray-400">{t('Pour une vidéo de plus de 50 Mo, publiez-la sur YouTube en « non répertoriée » et collez le lien.')}</p>
          <button type="button" onClick={() => p.ouvrirLibrairie(bloc.id)} className="text-sm font-semibold text-indigo-700 hover:underline">{t('📚 Choisir dans la librairie')}</button>
        </>
      )}
      <label className="flex items-start gap-2 text-sm text-gray-700 bg-amber-50 border border-amber-200 rounded-lg p-3 cursor-pointer">
        <input type="checkbox" className="mt-0.5 w-4 h-4" checked={meta(bloc).obligatoire === true}
          onChange={e => modifier(bloc.id, { metadata: { ...meta(bloc), obligatoire: e.target.checked } }, true)} />
        <span>
          <strong>{t('Visionnement obligatoire')}</strong>
          <span className="block text-xs text-gray-500">L’employé doit regarder au moins 90 % de la vidéo (sans avancer rapidement) pour pouvoir terminer la leçon.</span>
        </span>
      </label>
    </div>
  )
}

function EditeurFichier(p: PropsBloc) {
  const { t } = useT()
  const { bloc, modifier } = p
  const { enCours, envoyer } = useEnvoi(p, 'fichier')
  const nom = String(meta(bloc).nom_fichier ?? '')
  return (
    <div className="space-y-3">
      <input value={bloc.titre ?? ''} onChange={e => modifier(bloc.id, { titre: e.target.value || null })}
        placeholder={t('Nom affiché (ex. Politique de confidentialité 2026)')} className={champ + ' font-medium'} />
      <LienLibrairie {...p} />
      {bloc.url || bloc.contenu ? (
        <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <span className="truncate">📎 {nom || (estMediaPrive(bloc.url) ? t('Document privé') : bloc.url ?? bloc.contenu)}</span>
          <button onClick={() => { const m = { ...meta(bloc) }; delete m.librairie_id; modifier(bloc.id, { url: null, contenu: null, metadata: m }, true) }} className="text-xs text-blue-600 hover:underline flex-shrink-0 ml-2">{t('Remplacer')}</button>
        </div>
      ) : (
        <ZoneDepot genre="fichier" enCours={enCours}
          onFichier={f => envoyer(f, { metadata: { ...meta(bloc), nom_fichier: f.name }, titre: bloc.titre || f.name.replace(/\.[^.]+$/, '') })}
          texte={t('Glissez un document ici ou cliquez pour choisir')} />
      )}
      {!(bloc.url || bloc.contenu) && (
        <button type="button" onClick={() => p.ouvrirLibrairie(bloc.id)} className="text-sm font-semibold text-indigo-700 hover:underline">{t('📚 Choisir dans la librairie')}</button>
      )}
    </div>
  )
}

function EditeurLien({ bloc, modifier }: PropsBloc) {
  const { t } = useT()
  return (
    <div className="space-y-2">
      <input value={bloc.titre ?? ''} onChange={e => modifier(bloc.id, { titre: e.target.value || null })} placeholder={t('Titre')} className={champ} />
      <input value={bloc.url ?? bloc.contenu ?? ''} onChange={e => modifier(bloc.id, { url: e.target.value, contenu: null })}
        placeholder={t('Lien de la présentation (Google Slides, Canva…)')} className={champ} />
    </div>
  )
}

function EditeurQuiz({ bloc, modifier }: PropsBloc) {
  const { t } = useT()
  const quiz = lireQuiz(bloc.contenu)
  const maj = (q: Quiz) => modifier(bloc.id, { contenu: JSON.stringify(q) })
  const majQuestion = (i: number, changes: Partial<Quiz['questions'][number]>) =>
    maj({ questions: quiz.questions.map((q, j) => j === i ? { ...q, ...changes } : q) })

  return (
    <div className="space-y-4">
      <input value={bloc.titre ?? ''} onChange={e => modifier(bloc.id, { titre: e.target.value || null })}
        placeholder={t('Titre du quiz (ex. Vérifiez vos connaissances)')} className={champ + ' font-medium'} />
      {quiz.questions.map((q, i) => (
        <div key={i} className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
          <div className="flex items-start gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-1.5">{i + 1}</span>
            <ZoneTexteAuto rows={1} value={q.question} onChange={e => majQuestion(i, { question: e.target.value })} placeholder={t('Écrivez la question…')} />
            <button title={t('Supprimer la question')} onClick={() => maj({ questions: quiz.questions.filter((_, j) => j !== i) })}
              className="text-red-400 hover:text-red-600 px-1 mt-1.5" disabled={quiz.questions.length === 1}>✕</button>
          </div>
          <div className="space-y-2 pl-8">
            {q.reponses.map((r, j) => (
              <div key={j} className="flex items-center gap-2">
                <input type="radio" name={`bonne-${bloc.id}-${i}`} checked={q.bonne_reponse === j}
                  onChange={() => majQuestion(i, { bonne_reponse: j })} title={t('Bonne réponse')} className="w-4 h-4 accent-green-600" />
                <input value={r} onChange={e => majQuestion(i, { reponses: q.reponses.map((x, k) => k === j ? e.target.value : x) })}
                  placeholder={`Réponse ${j + 1}`}
                  className={champ + (q.bonne_reponse === j ? ' border-green-400 bg-green-50' : '')} />
                <button title={t('Retirer')} disabled={q.reponses.length <= 2}
                  onClick={() => majQuestion(i, {
                    reponses: q.reponses.filter((_, k) => k !== j),
                    bonne_reponse: q.bonne_reponse === j ? 0 : q.bonne_reponse > j ? q.bonne_reponse - 1 : q.bonne_reponse,
                  })}
                  className="text-gray-400 hover:text-red-500 disabled:opacity-20 px-1">✕</button>
              </div>
            ))}
            {q.reponses.length < 6 && (
              <button onClick={() => majQuestion(i, { reponses: [...q.reponses, ''] })} className="text-xs text-blue-600 hover:underline">
                {t('+ Ajouter une réponse')}
              </button>
            )}
            <p className="text-xs text-gray-400">{t('Cochez le rond de la bonne réponse.')}</p>
            <input value={q.explication ?? ''} onChange={e => majQuestion(i, { explication: e.target.value })}
              placeholder={t('Explication affichée après la réponse (optionnel)')} className={champ + ' text-xs'} />
          </div>
        </div>
      ))}
      <button onClick={() => maj({ questions: [...quiz.questions, nouvelleQuestion()] })}
        className="w-full text-sm font-medium text-blue-600 border border-dashed border-blue-300 rounded-lg py-2 hover:bg-blue-50">
        {t('+ Ajouter une question')}
      </button>
    </div>
  )
}
