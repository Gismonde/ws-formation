import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getLessonWithBlocks, getLessonsWithBlocks } from '@/lib/actions/lessons'
import { upsertLessonProgression } from '@/lib/actions/progressions'
import { getEtatSuivi } from '@/lib/actions/suivi'
import { modeApercu } from '@/lib/apercu-employe'
import { serviceClient } from '@/lib/permissions'
import { FournisseurSuivi, VideoSuivie, FinDeLecon, ExerciceSuivi, Apparition } from '@/components/lecon/SuiviLecon'
import { estComplet, refsMedias, type DonneesInteractif } from '@/lib/blocs-interactifs'
import { texteAttestationDefaut } from '@/lib/suivi-constantes'
import { i18n } from '@/lib/i18n/serveur'
import type { Traducteur } from '@/lib/i18n/base'
import AudioReader from '@/components/AudioReader'
import QuizInteractif from '@/components/lecon/QuizInteractif'
import { analyserVideoEnLigne, estMediaPrive } from '@/lib/medias'
import { signerUrlsMedias } from '@/lib/medias-serveur'
import { lireQuiz } from '@/lib/quiz'
import { passageDe, questionsDe } from '@/lib/video-passage'
import { TexteRiche, styleEncadre } from '@/lib/texte-riche'
import { CLINIQUE_INFO } from '@/lib/cliniques'

type Theme = { couleur: string; fond: string; logo: string; court: string; partenaires?: { logo: string; nom: string }[] } | null

type ContentBlock = {
  id: string
  type: 'text' | 'video' | 'quiz' | 'slide' | 'file' | 'image' | 'interactif'
  titre: string | null
  contenu: string | null
  url: string | null
  metadata?: Record<string, unknown> | null
  ordre: number
}

type Lesson = {
  id: string
  module_id: string
  titre: string
  description: string | null
  ordre: number
  blocs: ContentBlock[]
  attestation_requise?: boolean
  texte_attestation?: string | null
}

type Urls = Record<string, string>

/** Adresse affichable d'un bloc : média privé → adresse temporaire signée. */
function source(bloc: ContentBlock, urls: Urls): string {
  const brut = bloc.url || bloc.contenu || ''
  return estMediaPrive(brut) ? urls[brut] ?? '' : brut
}

function estVide(bloc: ContentBlock): boolean {
  if (bloc.type === 'interactif') return !estComplet(bloc.metadata as unknown as DonneesInteractif)
  if (bloc.type === 'quiz') return lireQuiz(bloc.contenu).questions.length === 0
  if (bloc.type === 'text') return !bloc.contenu?.trim() && !bloc.titre?.trim()
  return !(bloc.url || bloc.contenu)
}

function BlocTexte({ bloc, theme }: { bloc: ContentBlock; theme: Theme }) {
  const style = String(bloc.metadata?.style ?? 'normal')
  const s = styleEncadre(style, theme)
  return (
    <div className="rounded-xl p-6" style={{ background: s.fond, border: `1px solid ${s.bord}`, borderLeftWidth: style === 'normal' ? 1 : 4 }}>
      {bloc.titre && (
        <h3 className="text-lg font-semibold mb-3" style={{ color: s.titre }}>
          {style !== 'normal' && <span className="mr-2">{s.icone}</span>}{bloc.titre}
        </h3>
      )}
      <div className="text-gray-700 leading-relaxed">
        <TexteRiche texte={bloc.contenu ?? ''} />
      </div>
    </div>
  )
}

function BlocVideo({ bloc, urls }: { bloc: ContentBlock; urls: Urls }) {
  const brut = bloc.url || bloc.contenu || ''
  const enLigne = estMediaPrive(brut) ? null : analyserVideoEnLigne(brut)
  return (
    <VideoSuivie
      blocId={bloc.id}
      titre={bloc.titre}
      src={enLigne ? enLigne.embed : source(bloc, urls)}
      plateforme={enLigne ? enLigne.plateforme : 'fichier'}
      idEnLigne={enLigne?.id}
      obligatoire={bloc.metadata?.obligatoire === true}
      passage={passageDe(bloc.metadata)}
      questions={questionsDe(bloc.metadata)}
      boucle={bloc.metadata?.boucle === true}
    />
  )
}

function BlocImage({ bloc, urls }: { bloc: ContentBlock; urls: Urls }) {
  const alt = String(bloc.metadata?.alt ?? '') || bloc.titre || 'Image'
  return (
    <figure className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-4 bg-gray-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={source(bloc, urls)} alt={alt} className="w-full rounded-lg object-contain max-h-[32rem]" />
      </div>
      {bloc.titre && <figcaption className="px-6 py-3 text-sm text-gray-600 border-t border-gray-100">{bloc.titre}</figcaption>}
    </figure>
  )
}

function BlocFichier({ bloc, urls, t }: { bloc: ContentBlock; urls: Urls; t: Traducteur }) {
  const nom = String(bloc.metadata?.nom_fichier ?? '')
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className="w-11 h-11 rounded-lg bg-blue-50 flex items-center justify-center text-xl flex-shrink-0">📎</div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate">{bloc.titre || nom || t('Document')}</p>
        {nom && bloc.titre && <p className="text-xs text-gray-500 truncate">{nom}</p>}
      </div>
      <a href={source(bloc, urls)} target="_blank" rel="noopener noreferrer"
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex-shrink-0">
        {t('Ouvrir')}
      </a>
    </div>
  )
}

function BlocSlide({ bloc, urls, t }: { bloc: ContentBlock; urls: Urls; t: Traducteur }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {bloc.titre && (
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">{bloc.titre}</h3>
        </div>
      )}
      <div className="aspect-video">
        <iframe src={source(bloc, urls)} className="w-full h-full" allowFullScreen title={bloc.titre ?? t('Présentation')} />
      </div>
    </div>
  )
}

function RenduBloc({ bloc, urls, t, theme }: { bloc: ContentBlock; urls: Urls; t: Traducteur; theme: Theme }) {
  if (estVide(bloc)) return null
  switch (bloc.type) {
    case 'text': return <BlocTexte bloc={bloc} theme={theme} />
    case 'video': return <BlocVideo bloc={bloc} urls={urls} />
    case 'image': return <BlocImage bloc={bloc} urls={urls} />
    case 'file': return <BlocFichier bloc={bloc} urls={urls} t={t} />
    case 'slide': return <BlocSlide bloc={bloc} urls={urls} t={t} />
    case 'quiz': return <QuizInteractif quiz={lireQuiz(bloc.contenu)} titre={bloc.titre} />
    case 'interactif': return <ExerciceSuivi blocId={bloc.id} titre={bloc.titre} d={bloc.metadata as unknown as DonneesInteractif} urls={urls} />
    default: return null
  }
}

export default async function LecteurLeconPage({ params, searchParams }: {
  params: Promise<{ id: string; leconId: string }>
  searchParams: Promise<{ apercu?: string }>
}) {
  const { id: formationId, leconId } = await params
  // ?apercu=1 : ouverture depuis l'éditeur ; mode employé : parcours simulé. Dans les deux cas rien n'est enregistré.
  const { data: fClinique } = await serviceClient().from('formations').select('id, clinique').eq('id', formationId).maybeSingle()
  const apercu = fClinique ? await modeApercu(fClinique) : { actif: false, lecons: new Set<string>() }
  const suiviActif = (await searchParams).apercu !== '1' && !apercu.actif
  const { t, langue } = await i18n()
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: emp } = await supabase.from('employes').select('id, role, clinique').eq('auth_user_id', user.id).single()
  if (!emp) redirect('/login')

  // Charger la lecon avec ses blocs
  const resLecon = await getLessonWithBlocks(leconId)
  if (!resLecon.success || !resLecon.data) notFound()
  const lecon = resLecon.data as Lesson
  const urlsMedias = await signerUrlsMedias([...(lecon.blocs ?? []).map(b => b.url || b.contenu), ...(lecon.blocs ?? []).filter(b => b.type === 'interactif').flatMap(b => refsMedias(b.metadata))])

  // Charger la formation pour le contexte
  const { data: formation } = await serviceClient().from('formations').select('id, titre').eq('id', formationId).single()
  if (!formation) notFound()
  // Couleurs de la clinique : celle de la formation, sinon (formation commune) celle de l'employé
  const cliniqueTheme = fClinique?.clinique === 'CMC' || fClinique?.clinique === 'WSSC' ? fClinique.clinique
    : emp.clinique === 'CMC' || emp.clinique === 'WSSC' ? emp.clinique : null
  const theme: Theme = cliniqueTheme ? CLINIQUE_INFO[cliniqueTheme as 'CMC' | 'WSSC'] : null

  // Charger toutes les lecons du module pour la navigation
  const resLecons = await getLessonsWithBlocks(lecon.module_id)
  const toutesLecons: Lesson[] = resLecons.success ? (resLecons.data as Lesson[] || []) : []
  // Suivante / précédente : sur toute la formation (on passe au module suivant à la fin d'un module)
  const sbNav = serviceClient()
  const { data: modsNav } = await sbNav.from('modules').select('id, ordre').eq('formation_id', formationId).order('ordre')
  const { data: lecNav } = (modsNav ?? []).length ? await sbNav.from('lessons').select('id, titre, module_id, ordre').in('module_id', (modsNav ?? []).map(m => m.id)).order('ordre') : { data: [] as { id: string; titre: string; module_id: string; ordre: number }[] }
  const ordreGlobal = (modsNav ?? []).flatMap(m => (lecNav ?? []).filter(l => l.module_id === m.id))
  const indexGlobal = ordreGlobal.findIndex(l => l.id === leconId)
  const leconPrécédente = indexGlobal > 0 ? ordreGlobal[indexGlobal - 1] : null
  const leconSuivante = indexGlobal >= 0 && indexGlobal < ordreGlobal.length - 1 ? ordreGlobal[indexGlobal + 1] : null
  const changementModule = !!leconSuivante && leconSuivante.module_id !== lecon.module_id

  // Marquer la lecon comme vue automatiquement (si employe)
  const etatSuivi = apercu.actif
    ? { ...(await getEtatSuivi(leconId)), termineeLe: apercu.lecons.has(leconId) ? new Date().toISOString() : null, attestationLe: null, videosVues: [] }
    : await getEtatSuivi(leconId)
  if (suiviActif && !etatSuivi.termineeLe) {
    await upsertLessonProgression({ lesson_id: leconId, statut: 'en_cours' })
  }

  const baseUrl = '/formations/' + formationId

  return (
    <div className="min-h-screen bg-gray-50">
      {/* En-tete */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10" style={theme ? { borderTop: `4px solid ${theme.couleur}` } : undefined}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link href={baseUrl} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {theme && <img src={theme.logo} alt={theme.court} className="h-7 w-auto max-w-[110px] object-contain flex-shrink-0 hidden sm:block" />}
            {(theme?.partenaires ?? []).map(p => (
              <span key={p.nom} className="hidden md:flex items-center gap-3 flex-shrink-0">
                <span aria-hidden className="w-px h-6 bg-gray-200" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.logo} alt={p.nom} className="h-7 w-auto max-w-[110px] object-contain" />
              </span>
            ))}
            <div className="min-w-0">
              <p className="text-xs text-gray-500 truncate">{formation.titre}</p>
              <h1 className="text-base font-semibold text-gray-900 truncate">{lecon.titre}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {leconPrécédente && (
              <Link
                href={baseUrl + '/lecon/' + leconPrécédente.id}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="hidden sm:inline">{t('Précédente')}</span>
              </Link>
            )}
            {leconSuivante && (
              <Link
                href={baseUrl + '/lecon/' + leconSuivante.id}
                style={theme ? { background: theme.couleur } : undefined}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 hover:opacity-90 rounded-lg transition-colors"
              >
                <span className="hidden sm:inline">{t('Suivante')}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Titre et description de la lecon */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2" style={theme ? { color: theme.couleur } : undefined}>{lecon.titre}</h2>
          {lecon.description && (
            <p className="text-gray-600 leading-relaxed">{lecon.description}</p>
          )}
        </div>

        {/* Lecteur audio */}
        <AudioReader
          text={lecon.blocs.filter(b => b.type === 'text' && b.contenu).map(b => b.contenu!).join(' ')}
          title={lecon.titre}
        />
        {/* Blocs de contenu */}
        <FournisseurSuivi etat={etatSuivi} suiviActif={suiviActif}>
        {lecon.blocs.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-4xl mb-3">📄</div>
            <p className="text-gray-500">{t('Cette leçon n’a pas encore de contenu.')}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {lecon.blocs.sort((a, b) => a.ordre - b.ordre).map(bloc => (
              <Apparition key={bloc.id} actif={(lecon as { apparition_progressive?: boolean }).apparition_progressive === true}><RenduBloc bloc={bloc} urls={urlsMedias} t={t} theme={theme} /></Apparition>
            ))}
          </div>
        )}

          <FinDeLecon
            lessonId={leconId}
            attestationRequise={lecon.attestation_requise === true}
            texteAttestation={lecon.texte_attestation?.trim() || texteAttestationDefaut(langue)}
            videosObligatoires={lecon.blocs.filter(b => (b.type === 'video' || b.type === 'interactif') && b.metadata?.obligatoire === true && !estVide(b)).map(b => ({ id: b.id, titre: b.titre, nature: b.type === 'interactif' ? 'exercice' as const : 'video' as const }))}
            etat={etatSuivi}
            suiviActif={suiviActif}
            simulation={apercu.actif ? { formationId } : undefined}
          />
        </FournisseurSuivi>

        {/* Navigation bas de page */}
        <div className="mt-10 pt-6 border-t border-gray-200 flex items-center justify-between">
          <div>
            {leconPrécédente ? (
              <Link
                href={baseUrl + '/lecon/' + leconPrécédente.id}
                className="group flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
              >
                <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span>
                  <span className="block text-xs text-gray-400">{t('Leçon précédente')}</span>
                  <span className="font-medium">{leconPrécédente.titre}</span>
                </span>
              </Link>
            ) : (
              <Link href={baseUrl} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {t('Retour à la formation')}
              </Link>
            )}
          </div>
          <div>
            {leconSuivante ? (
              <Link
                href={baseUrl + '/lecon/' + leconSuivante.id}
                className="group flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
              >
                <span className="text-right">
                  <span className="block text-xs text-gray-400">{changementModule ? t('Module suivant') : t('Leçon suivante')}</span>
                  <span className="font-medium">{leconSuivante.titre}</span>
                </span>
                <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ) : (
              <Link
                href={baseUrl}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {t('Fin de la formation — retour')}
              </Link>
            )}
          </div>
        </div>

        {/* Navigation lecons du module */}
        {toutesLecons.length > 1 && (
          <div className="mt-8 bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('Leçons de ce module')}</h3>
            <div className="space-y-1">
              {toutesLecons.map((l, i) => (
                <Link
                  key={l.id}
                  href={baseUrl + '/lecon/' + l.id}
                  className={"flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors " + (l.id === leconId ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50')}
                >
                  <span className={"flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold " + (l.id === leconId ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500')}>
                    {i + 1}
                  </span>
                  {l.titre}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
