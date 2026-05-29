'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getFormationWithModules } from '@/lib/actions/formations'
import { getLessonsWithBlocks, createLesson, updateLesson, deleteLesson, reorderLessons, createContentBlock, updateContentBlock, deleteContentBlock, reorderContentBlocks } from '@/lib/actions/lessons'
import { createModule, updateModule, deleteModule, reorderModules } from '@/lib/actions/formations'
import type { Formation, Module, Lesson, ContentBlock } from '@/lib/types/formation'

type ModuleAvecLecons = Module & { lecons: (Lesson & { blocs: ContentBlock[] })[] }
type FormationAvecModules = Formation & { modules: ModuleAvecLecons[] }

type PanneauActif =
  | { type: 'aucun' }
  | { type: 'module'; moduleId: string }
  | { type: 'lecon'; leconId: string; moduleId: string }
  | { type: 'bloc'; blocId: string; leconId: string }

export default function EditeurFormationPage() {
  const params = useParams()
  const router = useRouter()
  const formationId = params.id as string

  const [formation, setFormation] = useState<FormationAvecModules | null>(null)
  const [panneau, setPanneau] = useState<PanneauActif>({ type: 'aucun' })
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [sauvegarde, setSauvegarde] = useState(false)

  // Formulaires
  const [titreModule, setTitreModule] = useState('')
  const [descModule, setDescModule] = useState('')
  const [titreLecon, setTitreLecon] = useState('')
  const [descLecon, setDescLecon] = useState('')
  const [typeBloc, setTypeBloc] = useState<'text' | 'video' | 'quiz' | 'slide' | 'file' | 'image'>('text')
  const [contenuBloc, setContenuBloc] = useState('')
  const [titreBloc, setTitreBloc] = useState('')

  const chargerFormation = useCallback(async () => {
    const res = await getFormationWithModules(formationId)
    if (!res.success) { setErreur(res.error); setChargement(false); return }
    const f = res.data as Formation & { modules: Module[] }
    // Charger les lecons de chaque module
    const modulesAvecLecons: ModuleAvecLecons[] = []
    for (const mod of (f.modules || [])) {
      const lr = await getLessonsWithBlocks(mod.id)
      modulesAvecLecons.push({
        ...mod,
        lecons: lr.success ? (lr.data as any[]) : []
      })
    }
    setFormation({ ...f, modules: modulesAvecLecons } as FormationAvecModules)
    setChargement(false)
  }, [formationId])

  useEffect(() => { chargerFormation() }, [chargerFormation])

  // Selectionner un element
  const selectionnerModule = (mod: ModuleAvecLecons) => {
    setPanneau({ type: 'module', moduleId: mod.id })
    setTitreModule(mod.titre)
    setDescModule(mod.description || '')
  }
  const selectionnerLecon = (lecon: Lesson & { blocs: ContentBlock[] }, moduleId: string) => {
    setPanneau({ type: 'lecon', leconId: lecon.id, moduleId })
    setTitreLecon(lecon.titre)
    setDescLecon(lecon.description || '')
  }

  // Actions modules
  const ajouterModule = async () => {
    setSauvegarde(true)
    const res = await createModule({
      formation_id: formationId,
      titre: 'Nouveau module',
      ordre: (formation?.modules?.length || 0) + 1
    })
    setSauvegarde(false)
    if (res.success) { chargerFormation(); selectionnerModule(res.data as ModuleAvecLecons) }
    else setErreur(res.error)
  }

  const sauvegarderModule = async () => {
    if (panneau.type !== 'module') return
    setSauvegarde(true)
    const res = await updateModule(panneau.moduleId, { titre: titreModule, description: descModule })
    setSauvegarde(false)
    if (res.success) chargerFormation()
    else setErreur(res.error)
  }

  const supprimerModule = async (moduleId: string) => {
    if (!confirm('Supprimer ce module et toutes ses lecons ?')) return
    setSauvegarde(true)
    const res = await deleteModule(moduleId)
    setSauvegarde(false)
    if (res.success) { chargerFormation(); setPanneau({ type: 'aucun' }) }
    else setErreur(res.error)
  }

  const monterModule = async (modules: ModuleAvecLecons[], index: number) => {
    if (index === 0) return
    const ordre = modules.map((m, i) => {
      if (i === index) return { id: m.id, ordre: index - 1 }
      if (i === index - 1) return { id: m.id, ordre: index }
      return { id: m.id, ordre: i }
    })
    await reorderModules(formationId, ordre)
    chargerFormation()
  }

  const descendreModule = async (modules: ModuleAvecLecons[], index: number) => {
    if (index >= modules.length - 1) return
    const ordre = modules.map((m, i) => {
      if (i === index) return { id: m.id, ordre: index + 1 }
      if (i === index + 1) return { id: m.id, ordre: index }
      return { id: m.id, ordre: i }
    })
    await reorderModules(formationId, ordre)
    chargerFormation()
  }

  // Actions lecons
  const ajouterLecon = async (moduleId: string, lecons: (Lesson & { blocs: ContentBlock[] })[]) => {
    setSauvegarde(true)
    const res = await createLesson({
      module_id: moduleId,
      titre: 'Nouvelle lecon',
      ordre: (lecons?.length || 0) + 1
    })
    setSauvegarde(false)
    if (res.success) { chargerFormation(); selectionnerLecon(res.data as any, moduleId) }
    else setErreur(res.error)
  }

  const sauvegarderLecon = async () => {
    if (panneau.type !== 'lecon') return
    setSauvegarde(true)
    const res = await updateLesson(panneau.leconId, { titre: titreLecon, description: descLecon })
    setSauvegarde(false)
    if (res.success) chargerFormation()
    else setErreur(res.error)
  }

  const supprimerLecon = async (leconId: string) => {
    if (!confirm('Supprimer cette lecon et tout son contenu ?')) return
    setSauvegarde(true)
    const res = await deleteLesson(leconId)
    setSauvegarde(false)
    if (res.success) { chargerFormation(); setPanneau({ type: 'aucun' }) }
    else setErreur(res.error)
  }

  const monterLecon = async (moduleId: string, lecons: (Lesson & { blocs: ContentBlock[] })[], index: number) => {
    if (index === 0) return
    const ordre = lecons.map((l, i) => {
      if (i === index) return { id: l.id, ordre: index - 1 }
      if (i === index - 1) return { id: l.id, ordre: index }
      return { id: l.id, ordre: i }
    })
    await reorderLessons(moduleId, ordre)
    chargerFormation()
  }

  const descendreLecon = async (moduleId: string, lecons: (Lesson & { blocs: ContentBlock[] })[], index: number) => {
    if (index >= lecons.length - 1) return
    const ordre = lecons.map((l, i) => {
      if (i === index) return { id: l.id, ordre: index + 1 }
      if (i === index + 1) return { id: l.id, ordre: index }
      return { id: l.id, ordre: i }
    })
    await reorderLessons(moduleId, ordre)
    chargerFormation()
  }

  // Actions blocs de contenu
  const ajouterBloc = async (leconId: string, nbBlocs: number) => {
    setSauvegarde(true)
    const res = await createContentBlock({
      lesson_id: leconId,
      type: typeBloc,
      titre: titreBloc || undefined,
      contenu: contenuBloc || undefined,
      ordre: nbBlocs + 1
    })
    setSauvegarde(false)
    if (res.success) { chargerFormation(); setTitreBloc(''); setContenuBloc('') }
    else setErreur(res.error)
  }

  const supprimerBloc = async (blocId: string) => {
    setSauvegarde(true)
    const res = await deleteContentBlock(blocId)
    setSauvegarde(false)
    if (res.success) chargerFormation()
    else setErreur(res.error)
  }

  const iconeBloc = (type: string) => {
    switch (type) {
      case 'text': return '📝'
      case 'video': return '🎬'
      case 'quiz': return '❓'
      case 'slide': return '🖼️'
      case 'file': return '📎'
      case 'image': return '🖼️'
      default: return '📄'
    }
  }

  if (chargement) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Chargement de l&apos;editeur...</p>
      </div>
    </div>
  )

  if (erreur && !formation) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-8 shadow-sm text-center">
        <p className="text-red-600 mb-4">{erreur}</p>
        <Link href="/admin/formations" className="text-blue-600 hover:underline">Retour aux formations</Link>
      </div>
    </div>
  )

  const moduleActif = panneau.type === 'module'
    ? formation?.modules.find(m => m.id === panneau.moduleId)
    : null
  const leconActive = panneau.type === 'lecon'
    ? formation?.modules.flatMap(m => m.lecons).find(l => l.id === panneau.leconId)
    : null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* En-tete */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/admin/formations" className="text-gray-500 hover:text-gray-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{formation?.titre}</h1>
            <p className="text-sm text-gray-500">Editeur de cours</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {sauvegarde && <span className="text-sm text-blue-600 animate-pulse">Sauvegarde...</span>}
          {erreur && <span className="text-sm text-red-600">{erreur}</span>}
          <Link
            href={"/admin/formations/" + formationId + "/apercu"}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Apercu
          </Link>
          <Link
            href={"/admin/formations/" + formationId + "/modifier"}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Parametres
          </Link>
        </div>
      </div>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Colonne gauche: structure du cours */}
        <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Structure</h2>
            <button
              onClick={ajouterModule}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Module
            </button>
          </div>

          {formation?.modules.length === 0 && (
            <div className="p-6 text-center">
              <div className="text-4xl mb-3">📚</div>
              <p className="text-sm text-gray-500 mb-4">Aucun module pour l&apos;instant</p>
              <button
                onClick={ajouterModule}
                className="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
              >
                Ajouter le premier module
              </button>
            </div>
          )}

          {formation?.modules.map((mod, modIndex) => (
            <div key={mod.id} className="border-b border-gray-100">
              {/* En-tete module */}
              <div
                className={"flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-gray-50 " + (panneau.type === 'module' && panneau.moduleId === mod.id ? 'bg-blue-50 border-l-2 border-blue-500' : '')}
                onClick={() => selectionnerModule(mod)}
              >
                <div className="flex flex-col gap-0.5 mr-1">
                  <button
                    onClick={e => { e.stopPropagation(); monterModule(formation.modules, modIndex) }}
                    className="text-gray-400 hover:text-gray-600 leading-none"
                    disabled={modIndex === 0}
                  >▲</button>
                  <button
                    onClick={e => { e.stopPropagation(); descendreModule(formation.modules, modIndex) }}
                    className="text-gray-400 hover:text-gray-600 leading-none"
                    disabled={modIndex === formation.modules.length - 1}
                  >▼</button>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">M{modIndex + 1}</span>
                    <span className="text-sm font-medium text-gray-800 truncate">{mod.titre}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{mod.lecons?.length || 0} lecon{(mod.lecons?.length || 0) !== 1 ? 's' : ''}</p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); ajouterLecon(mod.id, mod.lecons || []) }}
                  className="text-gray-400 hover:text-blue-600 p-1"
                  title="Ajouter une lecon"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>

              {/* Lecons du module */}
              {mod.lecons?.map((lecon, lecIndex) => (
                <div
                  key={lecon.id}
                  className={"flex items-center gap-2 pl-8 pr-4 py-2 cursor-pointer hover:bg-gray-50 " + (panneau.type === 'lecon' && panneau.leconId === lecon.id ? 'bg-blue-50 border-l-2 border-blue-500' : '')}
                  onClick={() => selectionnerLecon(lecon, mod.id)}
                >
                  <div className="flex flex-col gap-0.5 mr-1">
                    <button
                      onClick={e => { e.stopPropagation(); monterLecon(mod.id, mod.lecons, lecIndex) }}
                      className="text-gray-400 hover:text-gray-600 leading-none text-xs"
                      disabled={lecIndex === 0}
                    >▲</button>
                    <button
                      onClick={e => { e.stopPropagation(); descendreLecon(mod.id, mod.lecons, lecIndex) }}
                      className="text-gray-400 hover:text-gray-600 leading-none text-xs"
                      disabled={lecIndex === mod.lecons.length - 1}
                    >▼</button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-400">{modIndex + 1}.{lecIndex + 1}</span>
                      <span className="text-sm text-gray-700 truncate">{lecon.titre}</span>
                    </div>
                    <p className="text-xs text-gray-400">{lecon.blocs?.length || 0} bloc{(lecon.blocs?.length || 0) !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              ))}

              {/* Bouton ajouter lecon dans module */}
              {(mod.lecons?.length || 0) > 0 && (
                <button
                  onClick={() => ajouterLecon(mod.id, mod.lecons || [])}
                  className="w-full pl-10 pr-4 py-1.5 text-left text-xs text-blue-500 hover:text-blue-700 hover:bg-blue-50 flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Ajouter une lecon
                </button>
              )}
            </div>
          ))}

          {(formation?.modules?.length || 0) > 0 && (
            <div className="p-4">
              <button
                onClick={ajouterModule}
                className="w-full px-4 py-2 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Ajouter un module
              </button>
            </div>
          )}
        </div>

        {/* Panneau principal: edition */}
        <div className="flex-1 overflow-y-auto p-6">
          {panneau.type === 'aucun' && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <div className="text-6xl mb-4">✏️</div>
                <h2 className="text-xl font-semibold text-gray-800 mb-2">Editeur de cours</h2>
                <p className="text-gray-500 mb-6">Selectionnez un module ou une lecon dans la colonne de gauche pour l&apos;editer, ou ajoutez un nouveau module pour commencer.</p>
                <button
                  onClick={ajouterModule}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Creer le premier module
                </button>
              </div>
            </div>
          )}

          {/* Edition module */}
          {panneau.type === 'module' && moduleActif && (
            <div className="max-w-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Modifier le module</h2>
                <button
                  onClick={() => supprimerModule(panneau.moduleId)}
                  className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Supprimer
                </button>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Titre du module</label>
                  <input
                    type="text"
                    value={titreModule}
                    onChange={e => setTitreModule(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="Titre du module..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={descModule}
                    onChange={e => setDescModule(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                    placeholder="Description du module..."
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={sauvegarderModule}
                    disabled={sauvegarde}
                    className="px-6 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
                  >
                    {sauvegarde ? 'Sauvegarde...' : 'Sauvegarder'}
                  </button>
                  <button
                    onClick={() => ajouterLecon(panneau.moduleId, moduleActif.lecons || [])}
                    className="px-6 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors font-medium flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Ajouter une lecon
                  </button>
                </div>
              </div>

              {/* Lecons du module */}
              {(moduleActif.lecons?.length || 0) > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                    Lecons ({moduleActif.lecons.length})
                  </h3>
                  <div className="space-y-2">
                    {moduleActif.lecons.map((lecon, i) => (
                      <div
                        key={lecon.id}
                        className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 px-4 py-3 cursor-pointer hover:border-blue-300 transition-colors"
                        onClick={() => selectionnerLecon(lecon, panneau.moduleId)}
                      >
                        <span className="text-xs text-gray-400 font-mono w-6">{i + 1}.</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800">{lecon.titre}</p>
                          <p className="text-xs text-gray-400">{lecon.blocs?.length || 0} bloc(s) de contenu</p>
                        </div>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Edition lecon */}
          {panneau.type === 'lecon' && leconActive && (
            <div className="max-w-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Modifier la lecon</h2>
                <button
                  onClick={() => supprimerLecon(panneau.leconId)}
                  className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Supprimer
                </button>
              </div>

              {/* Infos lecon */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Titre de la lecon</label>
                  <input
                    type="text"
                    value={titreLecon}
                    onChange={e => setTitreLecon(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="Titre de la lecon..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={descLecon}
                    onChange={e => setDescLecon(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                    placeholder="Description de la lecon..."
                  />
                </div>
                <button
                  onClick={sauvegarderLecon}
                  disabled={sauvegarde}
                  className="px-6 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
                >
                  {sauvegarde ? 'Sauvegarde...' : 'Sauvegarder'}
                </button>
              </div>

              {/* Blocs de contenu */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                  Blocs de contenu ({leconActive.blocs?.length || 0})
                </h3>

                {leconActive.blocs?.map((bloc, i) => (
                  <div key={bloc.id} className="bg-white rounded-lg border border-gray-200 p-4 mb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{iconeBloc(bloc.type)}</span>
                        <span className="text-xs font-semibold text-gray-500 uppercase bg-gray-100 px-2 py-0.5 rounded">{bloc.type}</span>
                        {bloc.titre && <span className="text-sm font-medium text-gray-800">{bloc.titre}</span>}
                      </div>
                      <button
                        onClick={() => supprimerBloc(bloc.id)}
                        className="text-red-400 hover:text-red-600 p-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    {bloc.contenu && (
                      <p className="text-sm text-gray-600 bg-gray-50 rounded p-2 max-h-24 overflow-y-auto whitespace-pre-wrap">{bloc.contenu}</p>
                    )}
                    {bloc.url && (
                      <a href={bloc.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline truncate block mt-1">{bloc.url}</a>
                    )}
                  </div>
                ))}

                {/* Formulaire ajouter bloc */}
                <div className="bg-blue-50 rounded-xl border border-blue-200 p-5">
                  <h4 className="text-sm font-semibold text-blue-800 mb-3">Ajouter un bloc de contenu</h4>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                      <select
                        value={typeBloc}
                        onChange={e => setTypeBloc(e.target.value as typeof typeBloc)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="text">📝 Texte</option>
                        <option value="video">🎬 Video</option>
                        <option value="quiz">❓ Quiz</option>
                        <option value="slide">🖼️ Slide</option>
                        <option value="file">📎 Fichier</option>
                        <option value="image">🖼️ Image</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Titre (optionnel)</label>
                      <input
                        type="text"
                        value={titreBloc}
                        onChange={e => setTitreBloc(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Titre du bloc..."
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      {typeBloc === 'video' ? 'URL de la video' :
                       typeBloc === 'file' ? 'URL du fichier' :
                       typeBloc === 'image' ? 'URL de l&apos;image' :
                       typeBloc === 'quiz' ? 'JSON du quiz (questions/reponses)' :
                       'Contenu (texte, HTML ou URL)'}
                    </label>
                    <textarea
                      value={contenuBloc}
                      onChange={e => setContenuBloc(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      placeholder={typeBloc === 'video' ? 'https://www.youtube.com/embed/...' :
                                   typeBloc === 'text' ? 'Entrez votre texte ici...' :
                                   typeBloc === 'quiz' ? '{"questions":[{"question":"...","reponses":["A","B","C"],"bonne_reponse":0}]}' :
                                   'URL ou contenu...'}
                    />
                  </div>
                  <button
                    onClick={() => ajouterBloc(panneau.leconId, leconActive.blocs?.length || 0)}
                    disabled={sauvegarde || (!contenuBloc && !titreBloc)}
                    className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
                  >
                    {sauvegarde ? 'Ajout...' : 'Ajouter le bloc'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
