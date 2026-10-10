import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getLessonWithBlocks, getLessonsWithBlocks } from '@/lib/actions/lessons'
import { upsertLessonProgression } from '@/lib/actions/progressions'
import AudioReader from '@/components/AudioReader'
import QuizInteractif from '@/components/lecon/QuizInteractif'
import { analyserVideoEnLigne, estMediaPrive } from '@/lib/medias'
import { signerUrlsMedias } from '@/lib/medias-serveur'
import { lireQuiz } from '@/lib/quiz'
import { TexteRiche, STYLES_ENCADRE } from '@/lib/texte-riche'

type ContentBlock = {
  id: string
  type: 'text' | 'video' | 'quiz' | 'slide' | 'file' | 'image'
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
}

type Urls = Record<string, string>

/** Adresse affichable d'un bloc : média privé → adresse temporaire signée. */
function source(bloc: ContentBlock, urls: Urls): string {
  const brut = bloc.url || bloc.contenu || ''
  return estMediaPrive(brut) ? urls[brut] ?? '' : brut
}

function estVide(bloc: ContentBlock): boolean {
  if (bloc.type === 'quiz') return lireQuiz(bloc.contenu).questions.length === 0
  if (bloc.type === 'text') return !bloc.contenu?.trim() && !bloc.titre?.trim()
  return !(bloc.url || bloc.contenu)
}

function BlocTexte({ bloc }: { bloc: ContentBlock }) {
  const style = String(bloc.metadata?.style ?? 'normal')
  const s = STYLES_ENCADRE[style] ?? STYLES_ENCADRE.normal
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
  const src = source(bloc, urls)
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {bloc.titre && (
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">🎬 {bloc.titre}</h3>
        </div>
      )}
      <div className="aspect-video bg-black">
        {enLigne ? (
          <iframe src={enLigne.embed} className="w-full h-full" allowFullScreen title={bloc.titre ?? 'Vidéo'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
        ) : (
          <video src={src} controls controlsList="nodownload" preload="metadata" className="w-full h-full" />
        )}
      </div>
    </div>
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

function BlocFichier({ bloc, urls }: { bloc: ContentBlock; urls: Urls }) {
  const nom = String(bloc.metadata?.nom_fichier ?? '')
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className="w-11 h-11 rounded-lg bg-blue-50 flex items-center justify-center text-xl flex-shrink-0">📎</div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate">{bloc.titre || nom || 'Document'}</p>
        {nom && bloc.titre && <p className="text-xs text-gray-500 truncate">{nom}</p>}
      </div>
      <a href={source(bloc, urls)} target="_blank" rel="noopener noreferrer"
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex-shrink-0">
        Ouvrir
      </a>
    </div>
  )
}

function BlocSlide({ bloc, urls }: { bloc: ContentBlock; urls: Urls }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {bloc.titre && (
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">{bloc.titre}</h3>
        </div>
      )}
      <div className="aspect-video">
        <iframe src={source(bloc, urls)} className="w-full h-full" allowFullScreen title={bloc.titre ?? 'Présentation'} />
      </div>
    </div>
  )
}

function RenduBloc({ bloc, urls }: { bloc: ContentBlock; urls: Urls }) {
  if (estVide(bloc)) return null
  switch (bloc.type) {
    case 'text': return <BlocTexte bloc={bloc} />
    case 'video': return <BlocVideo bloc={bloc} urls={urls} />
    case 'image': return <BlocImage bloc={bloc} urls={urls} />
    case 'file': return <BlocFichier bloc={bloc} urls={urls} />
    case 'slide': return <BlocSlide bloc={bloc} urls={urls} />
    case 'quiz': return <QuizInteractif quiz={lireQuiz(bloc.contenu)} titre={bloc.titre} />
    default: return null
  }
}

export default async function LecteurLeconPage({ params }: { params: Promise<{ id: string; leconId: string }> }) {
  const { id: formationId, leconId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: emp } = await supabase.from('employes').select('id, role').eq('auth_user_id', user.id).single()
  if (!emp) redirect('/login')

  // Charger la lecon avec ses blocs
  const resLecon = await getLessonWithBlocks(leconId)
  if (!resLecon.success || !resLecon.data) notFound()
  const lecon = resLecon.data as Lesson
  const urlsMedias = await signerUrlsMedias((lecon.blocs ?? []).map(b => b.url || b.contenu))

  // Charger la formation pour le contexte
  const { data: formation } = await supabase.from('formations').select('id, titre').eq('id', formationId).single()
  if (!formation) notFound()

  // Charger toutes les lecons du module pour la navigation
  const resLecons = await getLessonsWithBlocks(lecon.module_id)
  const toutesLecons: Lesson[] = resLecon.success ? (resLecons.data as Lesson[] || []) : []
  const indexCourant = toutesLecons.findIndex(l => l.id === leconId)
  const leconPrecedente = indexCourant > 0 ? toutesLecons[indexCourant - 1] : null
  const leconSuivante = indexCourant < toutesLecons.length - 1 ? toutesLecons[indexCourant + 1] : null

  // Marquer la lecon comme vue automatiquement (si employe)
  if (emp.role === 'employe') {
    await upsertLessonProgression({ lesson_id: leconId, statut: 'en_cours' })
  }

  const baseUrl = '/formations/' + formationId

  return (
    <div className="min-h-screen bg-gray-50">
      {/* En-tete */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link href={baseUrl} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 truncate">{formation.titre}</p>
              <h1 className="text-base font-semibold text-gray-900 truncate">{lecon.titre}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {leconPrecedente && (
              <Link
                href={baseUrl + '/lecon/' + leconPrecedente.id}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="hidden sm:inline">Precedente</span>
              </Link>
            )}
            {leconSuivante && (
              <Link
                href={baseUrl + '/lecon/' + leconSuivante.id}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <span className="hidden sm:inline">Suivante</span>
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{lecon.titre}</h2>
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
        {lecon.blocs.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-4xl mb-3">📄</div>
            <p className="text-gray-500">Cette lecon n&apos;a pas encore de contenu.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {lecon.blocs.sort((a, b) => a.ordre - b.ordre).map(bloc => (
              <RenduBloc key={bloc.id} bloc={bloc} urls={urlsMedias} />
            ))}
          </div>
        )}

        {/* Navigation bas de page */}
        <div className="mt-10 pt-6 border-t border-gray-200 flex items-center justify-between">
          <div>
            {leconPrecedente ? (
              <Link
                href={baseUrl + '/lecon/' + leconPrecedente.id}
                className="group flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
              >
                <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span>
                  <span className="block text-xs text-gray-400">Lecon precedente</span>
                  <span className="font-medium">{leconPrecedente.titre}</span>
                </span>
              </Link>
            ) : (
              <Link href={baseUrl} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Retour a la formation
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
                  <span className="block text-xs text-gray-400">Lecon suivante</span>
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
                Module termine
              </Link>
            )}
          </div>
        </div>

        {/* Navigation lecons du module */}
        {toutesLecons.length > 1 && (
          <div className="mt-8 bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Lecons de ce module</h3>
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
