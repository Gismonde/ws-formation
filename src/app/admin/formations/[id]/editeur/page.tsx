'use client'

import { useT } from '@/lib/i18n/client'
import { useConfirmer } from '@/components/Confirmation'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getFormationWithModules } from '@/lib/actions/formations'
import { getLessonsWithBlocks, createLesson, updateLesson, deleteLesson, reorderLessons, createContentBlock } from '@/lib/actions/lessons'
import ChoixLibrairie, { blocPourChoix, type ElementChoisi } from '@/components/editeur/ChoixLibrairie'
import { createModule, updateModule, deleteModule, reorderModules } from '@/lib/actions/formations'
import type { Formation, Module, Lesson, ContentBlock } from '@/lib/types/formation'
import EditeurBlocs from '@/components/editeur/EditeurBlocs'
import EditeurQuestionnaire from '@/components/editeur/EditeurQuestionnaire'

type ModuleAvecLecons = Module & { lecons: (Lesson & { blocs: ContentBlock[] })[] }
type FormationAvecModules = Formation & { modules: ModuleAvecLecons[] }

type PanneauActif =
  | { type: 'aucun' }
  | { type: 'module'; moduleId: string }
  | { type: 'lecon'; leconId: string; moduleId: string }
  | { type: 'bloc'; blocId: string; leconId: string }
  | { type: 'questionnaire' }

export default function EditeurFormationPage() {
  const { t } = useT()
  const confirmer = useConfirmer()
  const params = useParams()
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
  const [attestationLecon, setAttestationLecon] = useState(false)
  const [apparitionLecon, setApparitionLecon] = useState(false)
  const [texteAttestation, setTexteAttestation] = useState('')
  const [showImportPptx, setShowImportPptx] = useState(false)
  const [importPptxFile, setImportPptxFile] = useState<File | null>(null)
  const [importPptxMode, setImportPptxMode] = useState<'one' | 'many'>('one')
  const [importPptxLoading, setImportPptxLoading] = useState(false)
  const [importPptxMessage, setImportPptxMessage] = useState<string | null>(null)

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
  const importerPptx = async () => {
    if (!importPptxFile || !formation) return
    setImportPptxLoading(true)
    setImportPptxMessage(null)
    try {
      const formData = new FormData()
      formData.append('file', importPptxFile)
      formData.append('formationId', formation.id)
      formData.append('moduleMode', importPptxMode)
      const res = await fetch('/api/import-pptx', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.success) {
        setImportPptxMessage(data.message || t('Import réussi !'))
        setImportPptxFile(null)
        await chargerFormation()
        setTimeout(() => { setShowImportPptx(false); setImportPptxMessage(null) }, 2000)
      } else {
        setImportPptxMessage('Erreur: ' + (data.error || 'Inconnu'))
      }
    } catch (e: any) {
      setImportPptxMessage('Erreur: ' + e.message)
    } finally {
      setImportPptxLoading(false)
    }
  }

  const selectionnerModule = (mod: ModuleAvecLecons) => {
    setPanneau({ type: 'module', moduleId: mod.id })
    setTitreModule(mod.titre)
    setDescModule(mod.description || '')
  }
  const selectionnerLecon = (lecon: Lesson & { blocs: ContentBlock[] }, moduleId: string) => {
    setPanneau({ type: 'lecon', leconId: lecon.id, moduleId })
    setTitreLecon(lecon.titre)
    setDescLecon(lecon.description || '')
    setAttestationLecon(lecon.attestation_requise === true)
    setApparitionLecon((lecon as { apparition_progressive?: boolean }).apparition_progressive === true)
    setTexteAttestation(lecon.texte_attestation || '')
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
    if (!(await confirmer({ message: t('Supprimer ce module et toutes ses leçons ?'), bouton: t('Supprimer'), danger: true }))) return
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
      titre: 'Nouvelle leçon',
      ordre: (lecons?.length || 0) + 1
    })
    setSauvegarde(false)
    if (res.success) { chargerFormation(); selectionnerLecon(res.data as any, moduleId) }
    else setErreur(res.error)
  }

  // Ajout depuis la librairie au niveau du module : une leçon par élément choisi
  const [librairieModule, setLibrairieModule] = useState<string | null>(null)
  const ajouterDepuisLibrairie = async (moduleId: string, elements: ElementChoisi[]) => {
    setLibrairieModule(null)
    const mod = formation?.modules?.find(m => m.id === moduleId)
    let ordre = mod?.lecons?.length || 0
    setSauvegarde(true)
    for (const e of elements) {
      ordre++
      const l = await createLesson({ module_id: moduleId, titre: e.titre, ordre })
      if (!l.success) { setErreur(l.error); break }
      const b = await createContentBlock({ lesson_id: (l.data as Lesson).id, ordre: 1, ...blocPourChoix(e) })
      if (!b.success) { setErreur(b.error); break }
    }
    setSauvegarde(false)
    chargerFormation()
  }

  const sauvegarderLecon = async () => {
    if (panneau.type !== 'lecon') return
    setSauvegarde(true)
    const res = await updateLesson(panneau.leconId, {
      titre: titreLecon, description: descLecon,
      attestation_requise: attestationLecon, texte_attestation: texteAttestation.trim() || null,
      apparition_progressive: apparitionLecon,
    })
    setSauvegarde(false)
    if (res.success) chargerFormation()
    else setErreur(res.error)
  }

  const supprimerLecon = async (leconId: string) => {
    if (!(await confirmer({ message: t('Supprimer cette leçon et tout son contenu ?'), bouton: t('Supprimer'), danger: true }))) return
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Chargement de l&apos;editeur...</p>
      </div>
    </div>
  )

  if (erreur && !formation) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-8 shadow-sm text-center">
        <p className="text-red-600 mb-4">{erreur}</p>
        <Link href="/admin/formations" className="text-indigo-600 hover:underline">{t('Retour aux formations')}</Link>
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
      {librairieModule && (
        <ChoixLibrairie types={['video', 'lien', 'document', 'politique']}
          onChoisirPlusieurs={els => ajouterDepuisLibrairie(librairieModule, els)} onFermer={() => setLibrairieModule(null)} />
      )}
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
            <p className="text-sm text-gray-500">{t('Éditeur de cours')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {sauvegarde && <span className="text-sm text-indigo-600 animate-pulse">{t('Sauvegarde...')}</span>}
          {erreur && <span className="text-sm text-red-600">{erreur}</span>}
          <Link
            href={"/admin/formations/" + formationId + "/apercu"}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            {t('Aperçu')}
          </Link>
          <a href={`/api/admin/formations/${formationId}/mode-employe`} className="px-4 py-2 text-sm bg-amber-100 text-amber-900 rounded-lg hover:bg-amber-200 transition-colors">👁 {t('Mode employé')}</a>
          <Link
            href={"/admin/formations/" + formationId + "/modifier"}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            {t('Paramètres')}
          </Link>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:h-[calc(100vh-73px)]">
        {/* Colonne gauche: structure du cours */}
        <div className="w-full md:w-80 max-h-72 md:max-h-none bg-white border-b md:border-b-0 md:border-r border-gray-200 overflow-y-auto flex-shrink-0">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{t('Structure')}</h2>
            <button
              onClick={ajouterModule}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('Module')}
            </button>
          </div>

          {formation?.modules.length === 0 && (
            <div className="p-6 text-center">
              <div className="text-4xl mb-3">📚</div>
              <p className="text-sm text-gray-500 mb-4">Aucun module pour l&apos;instant</p>
              <button
                onClick={ajouterModule}
                className="w-full px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
              >
                {t('Ajouter le premier module')}
              </button>
            </div>
          )}

          {formation?.modules.map((mod, modIndex) => (
            <div key={mod.id} className="border-b border-gray-100">
              {/* En-tete module */}
              <div
                className={"flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-gray-50 " + (panneau.type === 'module' && panneau.moduleId === mod.id ? 'bg-indigo-50 border-l-2 border-indigo-500' : '')}
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
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded">M{modIndex + 1}</span>
                    <span className="text-sm font-medium text-gray-800 truncate">{mod.titre}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{mod.lecons?.length || 0} leçon{(mod.lecons?.length || 0) !== 1 ? 's' : ''}</p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); ajouterLecon(mod.id, mod.lecons || []) }}
                  className="text-gray-400 hover:text-indigo-600 p-1"
                  title={t('Ajouter une leçon')}
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
                  className={"flex items-center gap-2 pl-8 pr-4 py-2 cursor-pointer hover:bg-gray-50 " + (panneau.type === 'lecon' && panneau.leconId === lecon.id ? 'bg-indigo-50 border-l-2 border-indigo-500' : '')}
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
                  className="w-full pl-10 pr-4 py-1.5 text-left text-xs text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {t('Ajouter une leçon')}
                </button>
              )}
            </div>
          ))}

          <button type="button" onClick={() => setPanneau({ type: 'questionnaire' })}
            className={'w-full text-left flex items-center gap-2 px-4 py-3 border-t border-gray-100 text-sm font-medium hover:bg-gray-50 ' + (panneau.type === 'questionnaire' ? 'bg-indigo-50 border-l-2 border-l-indigo-500 text-indigo-800' : 'text-gray-800')}>
            📝 {t('Questionnaire de fin de formation')}
          </button>

          {(formation?.modules?.length || 0) > 0 && (
            <div className="p-4">
              <button
                onClick={() => { setShowImportPptx(true); setImportPptxMessage(null) }}
                className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2 mb-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                {t('Importer un PowerPoint')}
              </button>
              <button
                onClick={ajouterModule}
                className="w-full px-4 py-2 text-sm text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t('Ajouter un module')}
              </button>
            </div>
          )}
        </div>

        {/* Panneau principal: edition */}
        <div className="flex-1 overflow-y-auto p-6">
          {panneau.type === 'questionnaire' && formation && (
            <EditeurQuestionnaire formationId={formationId} titreFormation={formation.titre} />
          )}
          {panneau.type === 'aucun' && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <div className="text-6xl mb-4">✏️</div>
                <h2 className="text-xl font-semibold text-gray-800 mb-2">{t('Éditeur de cours')}</h2>
                <p className="text-gray-500 mb-6">Sélectionnez un module ou une leçon dans la colonne de gauche pour l&apos;éditer, ou ajoutez un nouveau module pour commencer.</p>
                <button
                  onClick={ajouterModule}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                >
                  {t('Créer le premier module')}
                </button>
              </div>
            </div>
          )}

          {/* Edition module */}
          {panneau.type === 'module' && moduleActif && (
            <div className="max-w-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">{t('Modifier le module')}</h2>
                <button
                  onClick={() => supprimerModule(panneau.moduleId)}
                  className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  {t('Supprimer')}
                </button>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Titre du module')}</label>
                  <input
                    type="text"
                    value={titreModule}
                    onChange={e => setTitreModule(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    placeholder={t('Titre du module...')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Description')}</label>
                  <textarea
                    value={descModule}
                    onChange={e => setDescModule(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
                    placeholder={t('Description du module...')}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={sauvegarderModule}
                    disabled={sauvegarde}
                    className="px-6 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors font-medium"
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
                    {t('Ajouter une leçon')}
                  </button>
                  <button
                    onClick={() => setLibrairieModule(panneau.moduleId)}
                    className="px-6 py-2 bg-indigo-50 text-indigo-700 text-sm rounded-lg hover:bg-indigo-100 transition-colors font-medium"
                  >
                    {t('📚 Ajouter depuis la librairie')}
                  </button>
                </div>
              </div>

              {/* Lecons du module */}
              {(moduleActif.lecons?.length || 0) > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                    Leçons ({moduleActif.lecons.length})
                  </h3>
                  <div className="space-y-2">
                    {moduleActif.lecons.map((lecon, i) => (
                      <div
                        key={lecon.id}
                        className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 px-4 py-3 cursor-pointer hover:border-indigo-300 transition-colors"
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
            <div className="max-w-3xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">{t('Modifier la leçon')}</h2>
                <button
                  onClick={() => supprimerLecon(panneau.leconId)}
                  className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  {t('Supprimer')}
                </button>
              </div>

              {/* Infos lecon */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Titre de la leçon')}</label>
                  <input
                    type="text"
                    value={titreLecon}
                    onChange={e => setTitreLecon(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    placeholder={t('Titre de la leçon...')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Description')}</label>
                  <textarea
                    value={descLecon}
                    onChange={e => setDescLecon(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
                    placeholder={t('Description de la leçon...')}
                  />
                </div>
                <label className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3 cursor-pointer">
                  <input type="checkbox" className="mt-0.5 w-4 h-4" checked={apparitionLecon} onChange={e => setApparitionLecon(e.target.checked)} />
                  <span className="text-sm text-gray-700">
                    <strong>✨ {t('Apparition progressive des blocs')}</strong>
                    <span className="block text-xs text-gray-500 mt-0.5">{t('Les blocs apparaissent en douceur à mesure que l’employé fait défiler la leçon.')}</span>
                  </span>
                </label>
                <label className="flex items-start gap-3 bg-indigo-50 border border-indigo-200 rounded-lg p-3 cursor-pointer">
                  <input type="checkbox" className="mt-0.5 w-4 h-4" checked={attestationLecon}
                    onChange={e => setAttestationLecon(e.target.checked)} />
                  <span className="text-sm text-gray-700">
                    <strong>{t('Exiger « J’ai lu et compris » à la fin de la leçon')}</strong>
                    <span className="block text-xs text-gray-500 mt-0.5">{t('L’employé doit cocher la case pour terminer la leçon. La date et le texte accepté sont conservés comme preuve.')}</span>
                  </span>
                </label>
                {attestationLecon && (
                  <textarea
                    value={texteAttestation}
                    onChange={e => setTexteAttestation(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
                    placeholder="Texte de l'attestation (laisser vide pour : J'ai lu et compris le contenu de cette leçon et je m'engage à l'appliquer.)"
                  />
                )}
                <button
                  onClick={sauvegarderLecon}
                  disabled={sauvegarde}
                  className="px-6 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors font-medium"
                >
                  {sauvegarde ? 'Sauvegarde...' : 'Sauvegarder'}
                </button>
              </div>

              {/* Blocs de contenu : éditeur visuel */}
              <EditeurBlocs
                key={panneau.leconId}
                leconId={panneau.leconId}
                formationId={formationId}
                blocsInitiaux={leconActive.blocs || []}
                onModeleAttestation={async () => {
                  setAttestationLecon(true)
                  await updateLesson(panneau.leconId, { attestation_requise: true })
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Modal Import PowerPoint */}
      {showImportPptx && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">{t('📊 Importer un PowerPoint')}</h2>
              <button onClick={() => setShowImportPptx(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            <p className="text-sm text-gray-500 mb-4">{t('Chaque slide du PowerPoint sera convertie automatiquement en leçon avec son contenu.')}</p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Fichier PowerPoint (.pptx)</label>
              <input
                type="file"
                accept=".pptx"
                onChange={e => setImportPptxFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 border border-gray-300 rounded-lg p-2"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('Mode d\'organisation')}</label>
              <div className="space-y-2">
                <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-purple-50" style={{borderColor: importPptxMode === 'one' ? '#7c3aed' : '#e5e7eb'}}>
                  <input type="radio" value="one" checked={importPptxMode === 'one'} onChange={() => setImportPptxMode('one')} className="mt-0.5" />
                  <div>
                    <div className="font-medium text-sm">{t('1 module, N leçons')}</div>
                    <div className="text-xs text-gray-500">{t('Toutes les slides dans un seul module')}</div>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-purple-50" style={{borderColor: importPptxMode === 'many' ? '#7c3aed' : '#e5e7eb'}}>
                  <input type="radio" value="many" checked={importPptxMode === 'many'} onChange={() => setImportPptxMode('many')} className="mt-0.5" />
                  <div>
                    <div className="font-medium text-sm">{t('N modules, 1 leçon chacun')}</div>
                    <div className="text-xs text-gray-500">{t('Chaque slide devient un module independant')}</div>
                  </div>
                </label>
              </div>
            </div>

            {importPptxMessage && (
              <div className={`mb-4 p-3 rounded-lg text-sm ${importPptxMessage.startsWith('Erreur') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {importPptxMessage}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setShowImportPptx(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                {t('Annuler')}
              </button>
              <button
                onClick={importerPptx}
                disabled={!importPptxFile || importPptxLoading}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {importPptxLoading ? 'Import en cours...' : 'Importer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
