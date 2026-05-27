'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Departement { id: string; nom: string }
interface Employe {
  id: string
  prenom: string
  nom: string
  email: string
  poste: string | null
  role: string
  actif: boolean
  departement_id: string | null
  departements: { id: string; nom: string } | null
}
interface Props { employe: Employe; departements: Departement[] }

export default function EditEmployeForm({ employe, departements }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [form, setForm] = useState({
    prenom: employe.prenom || '',
    nom: employe.nom || '',
    poste: employe.poste || '',
    role: employe.role || 'employe',
    departement_id: employe.departement_id || '',
    actif: employe.actif
  })

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/admin/update-employee', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: employe.id, ...form, departement_id: form.departement_id || null })
    })
    const data = await res.json()
    setLoading(false)
    if (data.error) {
      setError(data.error)
    } else {
      setSuccess(true)
      setTimeout(() => router.push('/admin/employes'), 1500)
      router.refresh()
    }
  }

  const inputCls = "w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
  const labelCls = "block text-sm font-medium text-gray-700 mb-1"

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
        <p className="text-green-800 font-medium">Modifications enregistrees !</p>
        <p className="text-green-600 text-sm mt-1">Redirection en cours...</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Prenom *</label>
          <input className={inputCls} value={form.prenom} onChange={e => set('prenom', e.target.value)} required />
        </div>
        <div>
          <label className={labelCls}>Nom *</label>
          <input className={inputCls} value={form.nom} onChange={e => set('nom', e.target.value)} required />
        </div>
      </div>
      <div>
        <label className={labelCls}>Email</label>
        <input className={inputCls + ' bg-gray-50 text-gray-400 cursor-not-allowed'} value={employe.email} disabled />
        <p className="text-xs text-gray-400 mt-1">{"L'email ne peut pas etre modifie"}</p>
      </div>
      <div>
        <label className={labelCls}>Poste / Titre</label>
        <input className={inputCls} value={form.poste} onChange={e => set('poste', e.target.value)} placeholder="Ex: Infirmier(e), Technicien(ne)..." />
      </div>
      <div>
        <label className={labelCls}>Departement</label>
        <select className={inputCls} value={form.departement_id} onChange={e => set('departement_id', e.target.value)}>
          <option value="">-- Aucun departement --</option>
          {departements.map(d => (
            <option key={d.id} value={d.id}>{d.nom}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>Role</label>
        <select className={inputCls} value={form.role} onChange={e => set('role', e.target.value)}>
          <option value="employe">Employe</option>
          <option value="gestionnaire">Gestionnaire</option>
          <option value="admin">Administrateur</option>
        </select>
      </div>
      <div className="flex items-center gap-3">
        <input type="checkbox" id="actif" checked={form.actif} onChange={e => set('actif', e.target.checked)}
          className="w-4 h-4 text-blue-600 rounded border-gray-300" />
        <label htmlFor="actif" className="text-sm font-medium text-gray-700">Employe actif</label>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
          {loading ? 'Enregistrement...' : 'Enregistrer les modifications'}
        </button>
        <a href="/admin/employes"
          className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
          Annuler
        </a>
      </div>
    </form>
  )
}
