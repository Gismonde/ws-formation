'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Module {
  id: string
  titre: string
  contenu: string
  ordre: number
  duree_minutes: number
  formation_id: string
}

interface Formation {
  id: string
  titre: string
}

export default function ModulePage() {
  const params = useParams()
  const router = useRouter()
  const [module, setModule] = useState<Module | null>(null)
  const [formation, setFormation] = useState<Formation | null>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const formationId = params.id as string
      const moduleId = params.moduleId as string

      const [{ data: mod }, { data: form }, { data: mods }] = await Promise.all([
        supabase.from('modules').select('*').eq('id', moduleId).single(),
        supabase.from('formations').select('id, titre').eq('id', formationId).single(),
        supabase.from('modules').select('*').eq('formation_id', formationId).order('ordre'),
      ])

      if (mod) setModule(mod)
      if (form) setFormation(form)
      if (mods) setModules(mods)

      if (mod) {
        const { data: emp } = await supabase
          .from('employes').select('id').eq('auth_user_id', user.id).single()
        if (emp) {
          await supabase.from('progressions').upsert({
            employe_id: emp.id,
            module_id: moduleId,
            statut: 'complete',
            date_completion: new Date().toISOString(),
          }, { onConflict: 'employe_id,module_id' })
        }
      }
      setLoading(false)
    }
    loadData()
  }, [params.id, params.moduleId])

  if (loading) return <div className="flex justify-center items-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>
  if (!module || !formation) return <div className="p-8 text-center text-gray-500">Module introuvable.</div>

  const currentIndex = modules.findIndex(m => m.id === module.id)
  const prevModule = currentIndex > 0 ? modules[currentIndex - 1] : null
  const nextModule = currentIndex < modules.length - 1 ? modules[currentIndex + 1] : null
  const isLastModule = currentIndex === modules.length - 1

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3 text-sm">
          <button onClick={() => router.push('/formations')} className="text-blue-600 hover:underline">Formations</button>
          <span className="text-gray-400">&#x203A;</span>
          <button onClick={() => router.push(`/formations/${formation.id}`)} className="text-blue-600 hover:underline">{formation.titre}</button>
          <span className="text-gray-400">&#x203A;</span>
          <span className="text-gray-700 font-medium">{module.titre}</span>
        </div>
      </nav>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <span className="text-sm text-gray-500">Module {module.ordre} • {module.duree_minutes} min</span>
            <span className="bg-green-100 text-green-700 text-xs px-3 py-1 rounded-full font-medium">Complété</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-6">{module.titre}</h1>
          <div className="prose max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">{module.contenu}</div>
        </div>
        <div className="flex items-center justify-between">
          <button
            onClick={() => prevModule ? router.push(`/formations/${formation.id}/module/${prevModule.id}`) : router.push(`/formations/${formation.id}`)}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50 transition"
          >
            {prevModule ? prevModule.titre : 'Retour a la formation'}
          </button>
          {isLastModule ? (
            <button onClick={() => router.push(`/formations/${formation.id}/questionnaire`)} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium">
              Passer le questionnaire
            </button>
          ) : nextModule ? (
            <button onClick={() => router.push(`/formations/${formation.id}/module/${nextModule.id}`)} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium">
              Module suivant
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}