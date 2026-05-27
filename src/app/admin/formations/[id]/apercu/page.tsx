import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function ApercuFormationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // Vérifier que l'utilisateur est admin ou gestionnaire
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: emp } = await supabase.from('employes').select('role').eq('auth_user_id', user.id).single()
  if (!emp || emp.role === 'employe') redirect('/dashboard')

  // Charger la formation et ses modules
  const { data: formation } = await supabase.from('formations').select('*').eq('id', id).single()
  if (!formation) notFound()
  const { data: modules } = await supabase.from('modules').select('*').eq('formation_id', id).order('ordre')
  const { data: questionnaire } = await supabase.from('questionnaires').select('*').eq('formation_id', id).eq('actif', true).maybeSingle()

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Bannière mode aperçu */}
      <div className="bg-amber-500 text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg">👁️</span>
          <div>
            <p className="font-semibold text-sm">Mode aperçu — Vue employé</p>
            <p className="text-xs text-amber-100">Vous voyez exactement ce que verront les employés. Les progressions et boutons sont désactivés.</p>
          </div>
        </div>
        <Link
          href={`/admin/formations/${id}/modifier`}
          className="bg-white text-amber-600 hover:bg-amber-50 font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
        >
          ← Retour à l’éditeur
        </Link>
      </div>

      {/* Navigation employé (simulée) */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <span className="text-gray-400 text-sm cursor-not-allowed">← Dashboard</span>
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Aperçu</span>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8">

        {/* En-tête de la formation */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          {formation.categorie && (
            <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded mb-2 inline-block">
              {formation.categorie}
            </span>
          )}
          <h1 className="text-2xl font-bold text-gray-900">{formation.titre}</h1>
          {formation.description && (
            <p className="text-gray-500 mt-2">{formation.description}</p>
          )}

          {/* Barre de progression simulée à 0% */}
          <div className="mt-5">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Progression</span>
              <span className="font-medium text-gray-400">0% (aperçu)</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="bg-indigo-500 h-2 rounded-full" style={{ width: '0%' }} />
            </div>
          </div>

          {/* Métadonnées */}
          <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
            {formation.niveau && (
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                formation.niveau === 'debutant' ? 'bg-green-50 text-green-700' :
                formation.niveau === 'intermediaire' ? 'bg-yellow-50 text-yellow-700' :
                'bg-red-50 text-red-700'
              }`}>{formation.niveau}</span>
            )}
            {formation.duree_heures && (
              <span>⏱ {formation.duree_heures}h</span>
            )}
            <span>{modules?.length ?? 0} module{(modules?.length ?? 0) > 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Liste des modules */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Modules ({modules?.length ?? 0})</h2>
          {(!modules || modules.length === 0) ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-xl p-8 text-center text-gray-400">
              <p className="text-sm">Aucun module ajouté pour l’instant.</p>
              <Link href={`/admin/formations/${id}/modifier`} className="text-indigo-600 text-sm mt-2 inline-block hover:underline">
                + Ajouter des modules dans l’éditeur
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {modules.map((module: any, idx: number) => (
                <div key={module.id} className="bg-white border rounded-xl p-4 flex items-center gap-4 hover:border-indigo-200 transition">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold bg-gray-100 text-gray-500">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">{module.titre}</p>
                    {module.duree_minutes && (
                      <p className="text-xs text-gray-400 mt-0.5">⏱ {module.duree_minutes} min</p>
                    )}
                    {module.contenu && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{module.contenu.substring(0, 80)}{module.contenu.length > 80 ? '...' : ''}</p>
                    )}
                  </div>
                  {/* Bouton désactivé en aperçu */}
                  <button
                    disabled
                    className="text-sm px-4 py-1.5 rounded-lg font-medium bg-gray-100 text-gray-400 cursor-not-allowed"
                    title="Bouton désactivé en mode aperçu"
                  >
                    {idx === 0 ? 'Commencer' : 'Verrouillé'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Questionnaire (si présent) */}
        {questionnaire && (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">📝 {questionnaire.titre}</h2>
            {questionnaire.description && (
              <p className="text-gray-500 text-sm mb-4">{questionnaire.description}</p>
            )}
            <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
              {questionnaire.note_passage && <span>Note de passage : {questionnaire.note_passage}%</span>}
              {questionnaire.nb_tentatives_max && <span>Tentatives max : {questionnaire.nb_tentatives_max}</span>}
            </div>
            <button
              disabled
              className="bg-gray-300 text-gray-500 cursor-not-allowed font-semibold px-6 py-2.5 rounded-lg"
              title="Désactivé en mode aperçu"
            >
              Terminez tous les modules d’abord (0%)
            </button>
            <p className="text-xs text-gray-400 mt-2">Le questionnaire sera disponible après avoir complété tous les modules.</p>
          </div>
        )}
      </main>
    </div>
  )
}
