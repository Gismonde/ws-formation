import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function FormationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: employe } = await supabase.from('employes').select('id').eq('auth_user_id', user.id).single()
  const { data: formation } = await supabase.from('formations').select('*').eq('id', id).single()
  if (!formation) notFound()

  const { data: modules } = await supabase.from('modules').select('*').eq('formation_id', id).order('ordre')
  const { data: questionnaire } = await supabase.from('questionnaires').select('*').eq('formation_id', id).eq('actif', true).maybeSingle()
  const { data: progressions } = await supabase.from('progressions').select('module_id, statut').eq('employe_id', employe?.id ?? '').eq('formation_id', id)
  const { data: certificat } = await supabase.from('certificats').select('numero_certificat').eq('employe_id', employe?.id ?? '').eq('formation_id', id).maybeSingle()

  const modulesTermines = new Set(progressions?.filter((p: any) => p.statut === 'termine').map((p: any) => p.module_id) ?? [])
  const progressionPct = modules?.length ? Math.round((modulesTermines.size / modules.length) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/dashboard" className="text-gray-500 hover:text-gray-900 text-sm">← Dashboard</Link>
        </div>
      </nav>
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded mb-2 inline-block">{formation.categorie}</span>
          <h1 className="text-2xl font-bold text-gray-900">{formation.titre}</h1>
          <p className="text-gray-500 mt-2">{formation.description}</p>
          <div className="mt-5">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Progression</span><span className="font-medium">{progressionPct}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="bg-indigo-500 h-2 rounded-full" style={{width:`${progressionPct}%`}}/>
            </div>
          </div>
          {certificat && (
            <div className="mt-4 bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 flex items-center gap-2">
              <span className="text-purple-600">🏆</span>
              <span className="text-sm text-purple-700 font-medium">Certificat : {certificat.numero_certificat}</span>
            </div>
          )}
        </div>
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Modules ({modules?.length ?? 0})</h2>
          <div className="space-y-3">
            {modules?.map((module: any, idx: number) => {
              const termine = modulesTermines.has(module.id)
              const precedentTermine = idx === 0 || modulesTermines.has(modules[idx - 1].id)
              return (
                <div key={module.id} className={`bg-white border rounded-xl p-4 flex items-center gap-4 ${!precedentTermine ? 'opacity-60' : 'hover:border-indigo-300'} transition`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${termine ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                    {termine ? '✓' : idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">{module.titre}</p>
                    {module.duree_minutes && <p className="text-xs text-gray-400 mt-0.5">⏱ {module.duree_minutes} min</p>}
                  </div>
                  {precedentTermine && (
                    <Link href={`/formations/${id}/module/${module.id}`}>
                      <button className={`text-sm px-4 py-1.5 rounded-lg font-medium ${termine ? 'bg-green-50 text-green-600' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                        {termine ? 'Revoir' : 'Commencer'}
                      </button>
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        {questionnaire && (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">📝 {questionnaire.titre}</h2>
            <p className="text-gray-500 text-sm mb-4">{questionnaire.description}</p>
            <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
              <span>Note de passage : {questionnaire.note_passage}%</span>
              <span>Tentatives max : {questionnaire.nb_tentatives_max}</span>
            </div>
            <Link href={`/formations/${id}/questionnaire`}>
              <button disabled={progressionPct < 100}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-lg transition">
                {progressionPct < 100 ? `Terminez tous les modules d'abord (${progressionPct}%)` : 'Passer le questionnaire'}
              </button>
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}