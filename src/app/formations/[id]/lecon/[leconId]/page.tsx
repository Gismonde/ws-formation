import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getLessonWithBlocks, getLessonsWithBlocks } from '@/lib/actions/lessons'
import { upsertLessonProgression } from '@/lib/actions/progressions'

type ContentBlock = {
  id: string
  type: 'text' | 'video' | 'quiz' | 'slide' | 'file' | 'image'
  titre: string | null
  contenu: string | null
  url: string | null
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

function BlocTexte({ bloc }: { bloc: ContentBlock }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {bloc.titre && <h3 className="text-lg font-semibold text-gray-900 mb-3">{bloc.titre}</h3>}
      <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
        {bloc.contenu}
      </div>
    </div>
  )
}

function BlocVideo({ bloc }: { bloc: ContentBlock }) {
  const url = bloc.url || bloc.contenu || ''
  const isYouTube = url.includes('youtube.com') || url.includes('youtu.be')
  const isYouTubeEmbed = url.includes('youtube.com/embed')

  let embedUrl = url
  if (isYouTube && !isYouTubeEmbed) {
    const videoId = url.match(/(?:v=|youtu.be\/)([^&?]+)/)?.[1]
    if (videoId) embedUrl = 'https://www.youtube.com/embed/' + videoId
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {bloc.titre && (
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">{bloc.titre}</h3>
        </div>
      )}
      <div className="aspect-video bg-black">
        {(isYouTube || isYouTubeEmbed) ? (
          <iframe
            src={embedUrl}
            className="w-full h-full"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        ) : (
          <video
            src={url}
            controls
            className="w-full h-full"
          />
        )}
      </div>
    </div>
  )
}

function BlocImage({ bloc }: { bloc: ContentBlock }) {
  const url = bloc.url || bloc.contenu || ''
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {bloc.titre && (
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">{bloc.titre}</h3>
        </div>
      )}
      <div className="p-4">
        <img src={url} alt={bloc.titre || 'Image'} className="w-full rounded-lg object-contain max-h-96" />
      </div>
    </div>
  )
}

function BlocFichier({ bloc }: { bloc: ContentBlock }) {
  const url = bloc.url || bloc.contenu || ''
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {bloc.titre && <h3 className="text-lg font-semibold text-gray-900 mb-3">{bloc.titre}</h3>}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Telecharger le fichier
      </a>
    </div>
  )
}

function BlocSlide({ bloc }: { bloc: ContentBlock }) {
  const url = bloc.url || bloc.contenu || ''
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {bloc.titre && (
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">{bloc.titre}</h3>
        </div>
      )}
      <div className="aspect-video">
        <iframe
          src={url}
          className="w-full h-full"
          allowFullScreen
        />
      </div>
    </div>
  )
}

function BlocQuiz({ bloc }: { bloc: ContentBlock }) {
  let quiz: { questions: { question: string; reponses: string[]; bonne_reponse: number }[] } | null = null
  try {
    if (bloc.contenu) quiz = JSON.parse(bloc.contenu)
  } catch { /* ignore */ }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {bloc.titre && <h3 className="text-lg font-semibold text-gray-900 mb-4">{bloc.titre}</h3>}
      {quiz ? (
        <div className="space-y-6">
          {quiz.questions.map((q, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-4">
              <p className="font-medium text-gray-800 mb-3">{i + 1}. {q.question}</p>
              <div className="space-y-2">
                {q.reponses.map((r, j) => (
                  <label key={j} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 cursor-pointer">
                    <input type="radio" name={"q" + i} className="text-blue-600" />
                    <span className="text-sm text-gray-700">{r}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-gray-600 text-sm">{bloc.contenu}</p>
        </div>
      )}
    </div>
  )
}

function RenduBloc({ bloc }: { bloc: ContentBlock }) {
  switch (bloc.type) {
    case 'text': return <BlocTexte bloc={bloc} />
    case 'video': return <BlocVideo bloc={bloc} />
    case 'image': return <BlocImage bloc={bloc} />
    case 'file': return <BlocFichier bloc={bloc} />
    case 'slide': return <BlocSlide bloc={bloc} />
    case 'quiz': return <BlocQuiz bloc={bloc} />
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
    await upsertLessonProgression({ lecon_id: leconId, statut: 'en_cours' })
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

        {/* Blocs de contenu */}
        {lecon.blocs.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-4xl mb-3">📄</div>
            <p className="text-gray-500">Cette lecon n&apos;a pas encore de contenu.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {lecon.blocs.sort((a, b) => a.ordre - b.ordre).map(bloc => (
              <RenduBloc key={bloc.id} bloc={bloc} />
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
