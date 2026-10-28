'use client'
// Réglages d'un bloc vidéo dans l'éditeur : vidéo entière ou passage, questions en cours de vidéo.
import { useState } from 'react'
import { useT } from '@/lib/i18n/client'
import type { ControleVideo } from '@/components/video/LecteurVideo'
import { ecrireTemps, lireTemps, passageDe, type QuestionVideo } from '@/lib/video-passage'

type Meta = Record<string, unknown>

function ChampTemps({ valeur, onChange, onMaintenant, libelle }: { valeur: number | null; onChange: (v: number | null) => void; onMaintenant: () => void; libelle: string }) {
  const { t } = useT()
  const [texte, setTexte] = useState(ecrireTemps(valeur))
  const [erreur, setErreur] = useState(false)
  // Valeur changée de l'extérieur (bouton « moment actuel »)
  const affiche = ecrireTemps(valeur)
  if (!erreur && affiche !== texte && lireTemps(texte) !== valeur) setTexte(affiche)
  return (
    <div>
      <span className="block text-xs text-gray-500 mb-1">{libelle}</span>
      <div className="flex gap-1">
        <input value={texte} placeholder="0:00" className={'w-20 border rounded-lg px-2 py-1.5 text-sm ' + (erreur ? 'border-red-400' : 'border-gray-300')}
          onChange={e => { setTexte(e.target.value); const v = lireTemps(e.target.value); setErreur(e.target.value.trim() !== '' && v === null); if (v !== null || e.target.value.trim() === '') onChange(v) }} />
        <button type="button" onClick={onMaintenant} className="text-xs px-2 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 whitespace-nowrap">⏱ {t('Moment actuel')}</button>
      </div>
    </div>
  )
}

export default function ReglagesVideo({ meta, onMeta, controle, enLigne }: {
  meta: Meta
  onMeta: (m: Meta) => void
  controle: React.MutableRefObject<ControleVideo | null>
  /** Vidéo YouTube / Vimeo (le découpage guide seulement) ou fichier téléversé (seul le passage est accessible) */
  enLigne: boolean
}) {
  const { t } = useT()
  const passage = passageDe(meta)
  const brut = (meta.passage as { debut?: number; fin?: number | null } | undefined) ?? null
  const [mode, setMode] = useState<'entiere' | 'passage'>(brut ? 'passage' : 'entiere')
  const questions = (Array.isArray(meta.questions_video) ? meta.questions_video : []) as QuestionVideo[]
  const maintenant = () => Math.round(controle.current?.temps() ?? 0)

  const setPassage = (p: { debut?: number | null; fin?: number | null } | null) => {
    const m = { ...meta }
    if (!p) delete m.passage
    else m.passage = { debut: p.debut ?? 0, fin: p.fin ?? null }
    onMeta(m)
  }
  const setQuestions = (qs: QuestionVideo[]) => onMeta({ ...meta, questions_video: qs })
  const majQuestion = (id: string, p: Partial<QuestionVideo>) => setQuestions(questions.map(q => (q.id === id ? { ...q, ...p } : q)))

  return (
    <div className="space-y-3">
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
        <div className="flex flex-wrap gap-2 text-sm">
          <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" checked={mode === 'entiere'} onChange={() => { setMode('entiere'); setPassage(null) }} /> {t('Vidéo entière')}</label>
          <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" checked={mode === 'passage'} onChange={() => { setMode('passage'); setPassage({ debut: brut?.debut ?? 0, fin: brut?.fin ?? null }) }} /> {t('Un passage')}</label>
        </div>
        {mode === 'passage' && (
          <>
            <div className="flex flex-wrap gap-4">
              <ChampTemps libelle={t('Début')} valeur={brut?.debut ?? 0} onChange={v => setPassage({ debut: v ?? 0, fin: brut?.fin ?? null })} onMaintenant={() => setPassage({ debut: maintenant(), fin: brut?.fin ?? null })} />
              <ChampTemps libelle={t('Fin (vide = jusqu’à la fin)')} valeur={brut?.fin ?? null} onChange={v => setPassage({ debut: brut?.debut ?? 0, fin: v })} onMaintenant={() => setPassage({ debut: brut?.debut ?? 0, fin: maintenant() })} />
            </div>
            {brut && !passage && (brut.debut || brut.fin) ? <p className="text-xs text-red-600">{t('La fin doit être après le début.')}</p> : null}
            <p className="text-xs text-gray-500">{t('Astuce : lancez la vidéo ci-dessus, mettez-la en pause au bon endroit, puis cliquez « Moment actuel ». La même vidéo peut être utilisée dans plusieurs leçons avec des passages différents.')}</p>
            <p className={'text-xs rounded-md px-2 py-1.5 ' + (enLigne ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-green-50 text-green-800 border border-green-200')}>
              {enLigne
                ? t('Vidéo YouTube / Vimeo : le passage guide le visionnement (la lecture démarre et s’arrête aux bons moments), mais l’employé peut toujours ouvrir la vidéo complète sur YouTube ou Vimeo. Pour qu’il ne voie vraiment que le passage, téléversez la vidéo (fichier ou librairie).')
                : t('Vidéo téléversée : l’employé ne peut regarder que ce passage (impossible d’aller avant ou après).')}
            </p>
          </>
        )}
      </div>

      {!enLigne && (
        <label className="flex items-start gap-2 text-sm text-gray-700 bg-violet-50 border border-violet-200 rounded-lg p-3 cursor-pointer">
          <input type="checkbox" className="mt-0.5 w-4 h-4" checked={meta.boucle === true} onChange={e => onMeta({ ...meta, boucle: e.target.checked })} />
          <span><strong>{t('Extrait en boucle (comme un GIF)')}</strong><span className="block text-xs text-gray-500">{t('Lecture automatique, en boucle et sans son, sans commandes. Idéal pour une courte animation (quelques secondes).')}</span></span>
        </label>
      )}
      <label className="flex items-start gap-2 text-sm text-gray-700 bg-amber-50 border border-amber-200 rounded-lg p-3 cursor-pointer">
        <input type="checkbox" className="mt-0.5 w-4 h-4" checked={meta.sans_avance === true} onChange={e => onMeta({ ...meta, sans_avance: e.target.checked })} />
        <span><strong>⏩🚫 {t('Empêcher d’avancer dans la vidéo')}</strong><span className="block text-xs text-gray-500">{t('L’employé ne peut pas sauter plus loin que ce qu’il a déjà regardé (revenir en arrière reste possible). Une fois la vidéo vue en entier, il peut naviguer librement.')}{enLigne ? ' ' + t('YouTube / Vimeo : la lecture est ramenée au bon endroit, mais la vidéo reste consultable directement sur leur site.') : ''}</span></span>
      </label>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-800">❓ {t('Questions en cours de vidéo')} <span className="text-xs font-normal text-gray-500">({questions.length})</span></span>
          <button type="button" onClick={() => setQuestions([...questions, { id: crypto.randomUUID(), temps: maintenant(), question: '', choix: ['', ''], bonne: 0, explication: '' }])}
            className="text-xs font-semibold text-indigo-700 hover:underline">{t('+ Ajouter au moment actuel')}</button>
        </div>
        {questions.length === 0 && <p className="text-xs text-gray-500">{t('La vidéo se met en pause au moment choisi, pose la question, montre si la réponse est juste, puis reprend.')}</p>}
        <div className="space-y-3">
          {questions.map((q, n) => (
            <div key={q.id} className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
              <div className="flex flex-wrap items-end gap-3">
                <ChampTemps libelle={t('Moment')} valeur={q.temps} onChange={v => majQuestion(q.id, { temps: v ?? 0 })} onMaintenant={() => majQuestion(q.id, { temps: maintenant() })} />
                <button type="button" onClick={() => setQuestions(questions.filter(x => x.id !== q.id))} className="ml-auto text-xs text-gray-400 hover:text-red-600">{t('Supprimer la question {n}', { n: n + 1 })}</button>
              </div>
              <input value={q.question} onChange={e => majQuestion(q.id, { question: e.target.value })} placeholder={t('Question')} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
              {q.choix.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="radio" name={'bonne-' + q.id} checked={q.bonne === i} onChange={() => majQuestion(q.id, { bonne: i })} title={t('Bonne réponse')} />
                  <input value={c} onChange={e => majQuestion(q.id, { choix: q.choix.map((x, j) => (j === i ? e.target.value : x)) })} placeholder={t('Réponse {l}', { l: String.fromCharCode(65 + i) })} className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                  {q.choix.length > 2 && <button type="button" onClick={() => majQuestion(q.id, { choix: q.choix.filter((_, j) => j !== i), bonne: q.bonne === i ? 0 : q.bonne > i ? q.bonne - 1 : q.bonne })} className="text-xs text-gray-400 hover:text-red-600">✕</button>}
                </div>
              ))}
              {q.choix.length < 4 && <button type="button" onClick={() => majQuestion(q.id, { choix: [...q.choix, ''] })} className="text-xs text-indigo-700 hover:underline">{t('+ Réponse')}</button>}
              <input value={q.explication ?? ''} onChange={e => majQuestion(q.id, { explication: e.target.value })} placeholder={t('Explication affichée après la réponse (facultatif)')} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
              <p className="text-xs text-gray-400">{t('Cochez le rond de la bonne réponse.')}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
