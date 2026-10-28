'use client'

// Suivi d'une leçon côté employé :
//  - vidéos obligatoires : on mesure le temps réellement regardé (impossible de « sauter » à la fin)
//  - « J'ai lu et compris » et bouton « Terminer la leçon »

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { enregistrerVideoVue, attesterLecture, terminerLecon, type EtatSuivi } from '@/lib/actions/suivi'
import { ajouterAFile, horsLigne } from '@/lib/file-suivi'
import { useT } from '@/lib/i18n/client'
import LecteurVideo, { type ControleVideo } from '@/components/video/LecteurVideo'
import BlocInteractif from '@/components/lecon/BlocInteractif'
import type { DonneesInteractif } from '@/lib/blocs-interactifs'
import { dureeARegarder, ecrireTemps, questionAPoser, type Passage, type QuestionVideo } from '@/lib/video-passage'

const SEUIL_VISIONNEMENT = 0.9 // 90 % de la durée réellement regardée

type Ctx = {
  videosVues: string[]
  marquerVue: (blocId: string) => void
  suiviActif: boolean
}
const ContexteSuivi = createContext<Ctx>({ videosVues: [], marquerVue: () => {}, suiviActif: false })

export function FournisseurSuivi({ etat, suiviActif, children }: { etat: EtatSuivi; suiviActif: boolean; children: React.ReactNode }) {
  const [videosVues, setVideosVues] = useState<string[]>(etat.videosVues)
  const marquerVue = useCallback((blocId: string) => {
    setVideosVues(v => v.includes(blocId) ? v : [...v, blocId])
    if (!suiviActif) return
    // Hors ligne : gardé sur l'appareil et envoyé au retour du réseau
    if (horsLigne()) ajouterAFile({ type: 'video', id: blocId })
    else enregistrerVideoVue(blocId).catch(() => ajouterAFile({ type: 'video', id: blocId }))
  }, [suiviActif])
  return <ContexteSuivi.Provider value={{ videosVues, marquerVue, suiviActif }}>{children}</ContexteSuivi.Provider>
}

export const useSuivi = () => useContext(ContexteSuivi)

// ---------------------------------------------------------------------------
// Compteur de visionnement réel

function useCompteur(blocId: string, obligatoire: boolean) {
  const { videosVues, marquerVue } = useSuivi()
  const vue = videosVues.includes(blocId)
  const regarde = useRef(0)
  const [pourcentage, setPourcentage] = useState(vue ? 100 : 0)

  const avancer = useCallback((delta: number, duree: number) => {
    if (!obligatoire || vue || !duree) return
    if (delta > 0 && delta < 2.5) regarde.current += delta // un saut dans la vidéo ne compte pas
    const p = Math.min(100, Math.round((regarde.current / duree) * 100))
    setPourcentage(p)
    if (regarde.current >= duree * SEUIL_VISIONNEMENT) marquerVue(blocId)
  }, [obligatoire, vue, marquerVue, blocId])

  return { vue, pourcentage: vue ? 100 : pourcentage, avancer }
}

function BandeauObligatoire({ vue, pourcentage }: { vue: boolean; pourcentage: number }) {
  const { t } = useT()
  return (
    <div className={'px-4 py-2 text-xs flex items-center gap-3 ' + (vue ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-800')}>
      {vue ? <span>✅ {t('Vidéo regardée en entier')}</span> : (
        <>
          <span className="font-semibold">🎯 {t('Vidéo obligatoire')}</span>
          <span className="flex-1 h-1.5 bg-amber-100 rounded-full overflow-hidden">
            <span className="block h-full bg-amber-500 transition-all" style={{ width: pourcentage + '%' }} />
          </span>
          <span>{pourcentage}%</span>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Lecteur de leçon : passage, visionnement obligatoire, questions en cours de vidéo

export function VideoSuivie({ blocId, titre, src, plateforme, idEnLigne, obligatoire, passage = null, questions = [], boucle = false }: {
  boucle?: boolean
  blocId: string
  titre: string | null
  src: string
  plateforme: 'fichier' | 'youtube' | 'vimeo'
  idEnLigne?: string
  obligatoire: boolean
  passage?: Passage | null
  questions?: QuestionVideo[]
}) {
  const { vue, pourcentage, avancer } = useCompteur(blocId, obligatoire)
  const { t } = useT()
  const controle = useRef<ControleVideo | null>(null)
  const dernier = useRef<number | null>(null)
  const [repondues, setRepondues] = useState<string[]>([])
  const [active, setActive] = useState<QuestionVideo | null>(null)
  const [choix, setChoix] = useState<number | null>(null)

  const onTemps = useCallback((temps: number, duree: number) => {
    const precedent = dernier.current ?? temps
    dernier.current = temps
    avancer(temps - precedent, dureeARegarder(passage, duree))
    if (!active) {
      const q = questionAPoser(questions, repondues, temps)
      if (q) { controle.current?.pause(); setActive(q); setChoix(null) }
    }
  }, [avancer, passage, questions, repondues, active])

  const continuer = () => {
    if (!active) return
    setRepondues(r => [...r, active.id]); setActive(null); setChoix(null)
    setTimeout(() => controle.current?.lecture(), 50)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {titre && (
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">🎬 {titre}</h3>
          {passage && <p className="text-xs text-gray-500 mt-0.5">{t('Passage de {debut} à {fin}', { debut: ecrireTemps(passage.debut), fin: passage.fin ? ecrireTemps(passage.fin) : t('la fin') })}</p>}
        </div>
      )}
      <div className="relative aspect-video bg-black">
        <LecteurVideo plateforme={plateforme} src={src} idEnLigne={idEnLigne} debut={passage?.debut ?? 0} fin={passage?.fin ?? null} titre={titre} onTemps={onTemps} controle={controle} boucle={boucle && plateforme === 'fichier'} />
        {active && (
          <div className="absolute inset-0 z-10 bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-xl w-full max-w-lg p-5 shadow-xl">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 mb-1">❓ {t('Question')}</p>
              <p className="font-semibold text-gray-900 mb-3">{active.question}</p>
              <div className="space-y-2">
                {active.choix.map((c, i) => {
                  const repondu = choix !== null
                  const bon = i === active.bonne
                  const cls = !repondu ? 'border-gray-200 hover:border-indigo-400' : bon ? 'border-green-500 bg-green-50' : i === choix ? 'border-red-400 bg-red-50' : 'border-gray-200 opacity-60'
                  return (
                    <button key={i} type="button" disabled={repondu} onClick={() => setChoix(i)}
                      className={'w-full text-left text-sm rounded-lg border px-3 py-2 ' + cls}>
                      {String.fromCharCode(65 + i)}. {c}{repondu && bon ? ' ✓' : ''}
                    </button>
                  )
                })}
              </div>
              {choix !== null && (
                <div className="mt-3">
                  <p className={'text-sm font-semibold ' + (choix === active.bonne ? 'text-green-700' : 'text-red-700')}>{choix === active.bonne ? t('Bonne réponse !') : t('Ce n’est pas la bonne réponse.')}</p>
                  {active.explication && <p className="text-sm text-gray-600 mt-1">{active.explication}</p>}
                  <button type="button" onClick={continuer} className="mt-3 px-4 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: 'var(--accent-clinique, #4f46e5)' }}>▶ {t('Continuer la vidéo')}</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {obligatoire && !boucle && <BandeauObligatoire vue={vue} pourcentage={pourcentage} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Fin de leçon

export function FinDeLecon({ lessonId, attestationRequise, texteAttestation, videosObligatoires, etat, suiviActif, simulation }: {
  /** Mode employé : le parcours est simulé (progression gardée dans un cookie, rien en base) */
  simulation?: { formationId: string }
  lessonId: string
  attestationRequise: boolean
  texteAttestation: string
  videosObligatoires: { id: string; titre: string | null; nature?: 'video' | 'exercice' }[]
  etat: EtatSuivi
  suiviActif: boolean
}) {
  const { videosVues } = useSuivi()
  const { t, loc } = useT()
  const [attestationLe, setAttestationLe] = useState(etat.attestationLe)
  const [termineeLe, setTermineeLe] = useState(etat.termineeLe)
  const [horsLigneEnvoi, setHorsLigneEnvoi] = useState(false)
  const [coche, setCoche] = useState(!!etat.attestationLe)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const videosRestantes = videosObligatoires.filter(v => !videosVues.includes(v.id))
  const pret = videosRestantes.length === 0 && (!attestationRequise || coche)
  const date = (iso: string) => new Date(iso).toLocaleString(loc, { dateStyle: 'long', timeStyle: 'short' })

  if (!suiviActif && !simulation) {
    return (
      <div className="mt-8 rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">
        {attestationRequise
          ? t('Aperçu : les employés verront ici la case « J’ai lu et compris » et le bouton « Terminer la leçon ».')
          : t('Aperçu : les employés verront ici le bouton « Terminer la leçon ».')}
      </div>
    )
  }

  if (termineeLe) {
    return (
      <div className="mt-8 rounded-xl bg-green-50 border border-green-200 p-5 flex items-center gap-3">
        <span className="text-2xl">✅</span>
        <div>
          <p className="font-semibold text-green-800">{t('Leçon terminée')}</p>
          {horsLigneEnvoi && <p className="text-xs text-amber-700">📶 {t('Hors ligne : enregistré sur cet appareil, envoyé automatiquement au retour du réseau.')}</p>}
          <p className="text-sm text-green-700">{t('Le {date}', { date: date(termineeLe) })}{attestationLe ? t(' · attestation signée le {date}', { date: date(attestationLe) }) : ''}</p>
        </div>
      </div>
    )
  }

  async function terminer() {
    setEnCours(true); setErreur(null)
    if (simulation) {
      const r = await fetch('/api/apercu/progression', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ formationId: simulation.formationId, leconId: lessonId }) })
      setEnCours(false)
      if (r.ok) { if (attestationRequise) setAttestationLe(new Date().toISOString()); setTermineeLe(new Date().toISOString()) }
      else setErreur(t('Erreur'))
      return
    }
    // Hors ligne (ou réseau coupé pendant l'envoi) : enregistré sur l'appareil, envoyé au retour du réseau
    const enAttente = () => {
      if (attestationRequise && !attestationLe) { ajouterAFile({ type: 'attestation', id: lessonId }); setAttestationLe(new Date().toISOString()) }
      ajouterAFile({ type: 'terminer', id: lessonId })
      setTermineeLe(new Date().toISOString()); setHorsLigneEnvoi(true); setEnCours(false)
    }
    if (horsLigne()) { enAttente(); return }
    try {
    if (attestationRequise && !attestationLe) {
      const r = await attesterLecture(lessonId)
      if (!r.ok) { setErreur(r.erreur); setEnCours(false); return }
      setAttestationLe(r.data ?? new Date().toISOString())
    }
    const r = await terminerLecon(lessonId)
    setEnCours(false)
    if (r.ok) setTermineeLe(r.data ?? new Date().toISOString())
    else setErreur(r.manquants?.length ? t('Il reste : {liste}', { liste: r.manquants.join(' · ') }) : r.erreur)
    } catch { enAttente() }
  }

  return (
    <div className="mt-8 bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h3 className="font-semibold text-gray-900">{t('Terminer la leçon')}</h3>

      {videosObligatoires.length > 0 && (
        <ul className="space-y-1 text-sm">
          {videosObligatoires.map(v => (
            <li key={v.id} className={videosVues.includes(v.id) ? 'text-green-700' : 'text-gray-600'}>
              {videosVues.includes(v.id) ? '✅' : '⏳'} {v.nature === 'exercice' ? t('Exercice « {titre} » réussi', { titre: v.titre || t('sans titre') }) : t('Vidéo « {titre} » regardée en entier', { titre: v.titre || t('sans titre') })}
            </li>
          ))}
        </ul>
      )}

      {attestationRequise && (
        <label className={'flex items-start gap-3 rounded-lg border p-4 cursor-pointer ' + (coche ? 'border-blue-400 bg-blue-50' : 'border-gray-200')}>
          <input type="checkbox" className="mt-1 w-4 h-4" checked={coche} disabled={!!attestationLe}
            onChange={e => setCoche(e.target.checked)} />
          <span className="text-sm text-gray-800 whitespace-pre-line">{texteAttestation}</span>
        </label>
      )}

      {erreur && <p className="text-sm text-red-600">{erreur}</p>}

      <button onClick={terminer} disabled={!pret || enCours}
        className="px-5 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-40">
        {enCours ? t('Enregistrement…') : `✓ ${t('Terminer la leçon')}`}
      </button>
      {!pret && videosRestantes.length > 0 && (
        <p className="text-xs text-gray-500">{videosRestantes.some(v => v.nature === 'exercice') ? t('Terminez d’abord les vidéos et exercices obligatoires.') : videosRestantes.length > 1 ? t('Regardez d’abord les vidéos obligatoires en entier.') : t('Regardez d’abord la vidéo obligatoire en entier.')}</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Exercices interactifs et apparition progressive

/** Bloc interactif ; un exercice réussi est noté (exigé pour terminer la leçon s'il est obligatoire). */
export function ExerciceSuivi({ blocId, titre, d, urls }: { blocId: string; titre: string | null; d: DonneesInteractif; urls: Record<string, string> }) {
  const { marquerVue, videosVues } = useSuivi()
  const { t } = useT()
  const fait = videosVues.includes(blocId)
  return (
    <div>
      <BlocInteractif titre={titre} d={d} urls={urls} onReussi={() => marquerVue(blocId)} />
      {d.obligatoire && <p className={'text-xs mt-1 ' + (fait ? 'text-green-700' : 'text-amber-700')}>{fait ? '✅ ' + t('Exercice réussi') : '🎯 ' + t('Exercice obligatoire pour terminer la leçon')}</p>}
    </div>
  )
}

/** Fait apparaître le bloc en douceur quand il arrive à l'écran. */
export function Apparition({ actif, children }: { actif: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(!actif)
  useEffect(() => {
    if (!actif || !ref.current) return
    const reduit = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduit) { setVisible(true); return }
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); o.disconnect() } }, { threshold: 0.12 })
    o.observe(ref.current)
    return () => o.disconnect()
  }, [actif])
  return (
    <div ref={ref} style={actif ? { opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(24px)', transition: 'opacity .6s ease, transform .6s ease' } : undefined}>
      {children}
    </div>
  )
}

