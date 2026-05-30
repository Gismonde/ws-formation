'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Formation {
  id: string
  titre: string
  categorie: string
  description: string
  niveau: string
  duree_heures: number
  est_publiee: boolean
    validite_mois: number | null
}

interface ModuleForm {
  id?: string
  titre: string
  contenu: string
  duree_minutes: number
  ordre: number
}

export default function ModifierFormationPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()

  const [formation, setFormation] = useState<Formation | null>(null)
  const [modules, setModules] = useState<ModuleForm[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: emp } = await supabase.from('employes').select('role').eq('auth_user_id', user.id).single()
      if (!emp || emp.role === 'employe') { router.push('/dashboard'); return }

      const formationId = params.id as string
      const [{ data: f }, { data: mods }] = await Promise.all([
        supabase.from('formations').select('*').eq('id', formationId).single(),
        supabase.from('modules').select('*').eq('formation_id', formationId).order('ordre'),
      ])

      if (f) setFormation(f)
      if (mods) setModules(mods)
      setLoading(false)
    }
    loadData()
  }, [params.id])

  function updateField(field: keyof Formation, value: string | number | boolean) {
    setFormation(prev => prev ? { ...prev, [field]: value } : prev)
  }

  function updateModule(idx: number, field: keyof ModuleForm, value: string | number) {
    setModules(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m))
  }

  function addModule() {
    setModules(prev => [...prev, { titre: '', contenu: '', duree_minutes: 30, ordre: prev.length + 1 }])
  }

  function removeModule(idx: number) {
    setModules(prev => prev.filter((_, i) => i !== idx).map((m, i) => ({ ...m, ordre: i + 1 })))
  }

  async function handleSave() {
    if (!formation || !formation.titre.trim()) { setError('Le titre est requis.'); return }
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const { error: fErr } = await supabase.from('formations').update({
        titre: formation.titre,
        categorie: formation.categorie,
        description: formation.description,
        niveau: formation.niveau,
        duree_heures: formation.duree_heures,
        est_publiee: formation.est_publiee,
                validite_mois: formation.validite_mois,
      }).eq('id', formation.id)

      if (fErr) { setError(fErr.message); setSaving(false); return }

      // Update existing modules
      for (const mod of modules) {
        if (mod.id) {
          await supabase.from('modules').update({
            titre: mod.titre,
            contenu: mod.contenu,
            duree_minutes: mod.duree_minutes,
            ordre: mod.ordre,
          }).eq('id', mod.id)
        } else {
          await supabase.from('modules').insert({
            formation_id: formation.id,
            titre: mod.titre,
            contenu: mod.contenu,
            duree_minutes: mod.duree_minutes,
            ordre: mod.ordre,
          })
        }
      }

      setSuccess('Formation mise à jour avec succès!')
      setSaving(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur inattendue')
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!formation) return
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette formation? Cette action est irréversible.')) return

    const { error } = await supabase.from('formations').delete().eq('id', formation.id)
    if (error) { setError(error.message); return }
    router.push('/admin/formations')
  }

  if (loading) return <div className="flex justify-center items-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>
  if (!formation) return <div className="p-8 text-center text-gray-500">Formation introuvable.</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Modifier la formation</h1>
            <p className="text-gray-500 mt-1 truncate max-w-md">{formation.titre}</p>
          </div>
          <div className="flex gap-3">
            <a
              href={`/admin/formations/${params.id}/apercu`}
              className="px-4 py-2 border border-amber-300 text-amber-600 rounded-lg hover:bg-amber-50 transition flex items-center gap-2 text-sm font-medium"
              target="_blank"
              rel="noopener noreferrer"
            >
              👁️ Aperçu employé
            </a>
            <button onClick={handleDelete} className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition">Supprimer</button>
            <button onClick={() => router.push('/admin/formations')} className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">Retour</button>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-6">{error}</div>}
        {success && <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg mb-6">{success}</div>}

        {/* Infos générales */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Informations générales</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
              <input type="text" value={formation.titre} onChange={e => updateField('titre', e.target.value)} className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={formation.description || ''} onChange={e => updateField('description', e.target.value)} rows={3} className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Section / Catégorie</label>
              <select value={formation.categorie || ''} onChange={e => updateField('categorie', e.target.value)} className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500">
                <option value="Administration médicale">Administration médicale</option>
                <option value="Confidentialité &amp; Loi 25">Confidentialité &amp; Loi 25</option>
                <option value="DSQ">DSQ</option>
                <option value="Recherche clinique">Recherche clinique</option>
                <option value="SOP &amp; politiques internes">SOP &amp; politiques internes</option>
                <option value="Sécurité informatique">Sécurité informatique</option>
                <option value="Santé &amp; sécurité">Santé &amp; sécurité</option>
                <option value="Onboarding nouveaux employés">Onboarding nouveaux employés</option>
                <option value="Formation continue">Formation continue</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Niveau</label>
                <select value={formation.niveau} onChange={e => updateField('niveau', e.target.value)} className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500">
                  <option value="debutant">Débutant</option>
                  <option value="intermediaire">Intermédiaire</option>
                  <option value="avance">Avancé</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Durée (heures)</label>
                <input type="number" value={formation.duree_heures} onChange={e => updateField('duree_heures', Number(e.target.value))} min={1} className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="publiee" checked={formation.est_publiee} onChange={e => updateField('est_publiee', e.target.checked)} className="h-4 w-4 text-blue-600 rounded" />
              <label htmlFor="publiee" className="text-sm font-medium text-gray-700">Formation publiée (visible par les employés)</label>
            </div>
          </div>
          
          {/* Durée de validité */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
            <h3 className="text-sm font-semibold text-amber-900 mb-3">⏱️ Validité du certificat</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Durée de validité (mois)
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  placeholder="Ex: 12 pour 1 an, 24 pour 2 ans..."
                  value={formation.validite_mois ?? ''}
                  onChange={e => updateField('validite_mois', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div className="flex items-end pb-1">
                <p className="text-xs text-amber-700">
                  {formation.validite_mois
                    ? formation.validite_mois >= 12
                      ? `Certificat valide ${Math.floor(formation.validite_mois / 12)} an(s)${formation.validite_mois % 12 > 0 ? ` et ${formation.validite_mois % 12} mois` : ''}`
                      : `Certificat valide ${formation.validite_mois} mois`
                    : 'Aucune expiration (certificat permanent)'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modules */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Modules ({modules.length})</h2>
            <button onClick={addModule} className="text-sm text-blue-600 hover:text-blue-700 font-medium">+ Ajouter un module</button>
          </div>
          <div className="space-y-4">
            {modules.map((mod, idx) => (
              <div key={idx} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">Module {mod.ordre}</span>
                  {modules.length > 1 && <button onClick={() => removeModule(idx)} className="text-red-500 hover:text-red-700 text-sm">Supprimer</button>}
                </div>
                <div className="space-y-3">
                  <input type="text" value={mod.titre} onChange={e => updateModule(idx, 'titre', e.target.value)} className="w-full border rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500" placeholder="Titre du module" />
                  <textarea value={mod.contenu} onChange={e => updateModule(idx, 'contenu', e.target.value)} rows={4} className="w-full border rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500" placeholder="Contenu du module..." />
                  <div
                    <label className="text-sm text-gray-600">Durée (minutes)</label>
                    <input type="number" value={mod.duree_minutes} onChange={e => updateModule(idx, 'duree_minutes', Number(e.target.value))} min={5} className="ml-3 w-24 border rounded px-2 py-1 text-sm bg-white" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button onClick={() => router.push('/admin/formations')} className="px-6 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">Annuler</button>
          <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
            {saving ? 'Enregistrement...' : 'Sauvegarder'}
          </button>
        </div>
      </div>
    </div>
  )
}
