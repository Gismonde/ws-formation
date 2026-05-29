'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Formation {
  id: string
  titre: string
  description: string | null
  categorie: string | null
  niveau: string | null
}

interface Employe {
  id: string
  prenom: string
  nom: string
  departement_id: string | null
  departement_nom: string | null
}

interface Departement {
  id: string
  nom: string
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function AssignerFormationPage({ params }: PageProps) {
  const router = useRouter()
  const [formationId, setFormationId] = useState<string>('')
  const [formation, setFormation] = useState<Formation | null>(null)
  const [employes, setEmployes] = useState<Employe[]>([])
  const [departements, setDepartements] = useState<Departement[]>([])
  const [userRole, setUserRole] = useState<string>('')
  const [userDeptId, setUserDeptId] = useState<string | null>(null)
  const [type, setType] = useState<'departement' | 'employe'>('departement')
  const [cibleId, setCibleId] = useState<string>('')
  const [dateEcheance, setDateEcheance] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    params.then(p => setFormationId(p.id))
  }, [params])

  useEffect(() => {
    if (!formationId) return
    fetchData()
  }, [formationId])

  async function fetchData() {
    try {
      const res = await fetch(`/api/admin/assigner-formation-data?formationId=${formationId}`)
      if (!res.ok) throw new Error('Erreur chargement')
      const data = await res.json()
      setFormation(data.formation)
      setEmployes(data.employes)
      setDepartements(data.departements)
      setUserRole(data.userRole)
      setUserDeptId(data.userDeptId)
      if (data.departements.length > 0) {
        const defaultDept = data.userRole === 'gestionnaire' && data.userDeptId
          ? data.userDeptId
          : data.departements[0]?.id
        setCibleId(defaultDept || '')
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Impossible de charger les données' })
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!cibleId) {
      setMessage({ type: 'error', text: 'Veuillez sélectionner une cible' })
      return
    }
    setSubmitting(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/assign-formation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formationId,
          type,
          cibleId,
          dateEcheance: dateEcheance || undefined
        })
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Erreur lors de l\'assignation' })
      } else {
        setMessage({
          type: 'success',
          text: `${data.assigned} assignation(s) créée(s)${data.skipped > 0 ? `, ${data.skipped} déjà assignée(s)` : ''}`
        })
        setTimeout(() => router.push('/admin/formations'), 1500)
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur réseau' })
    } finally {
      setSubmitting(false)
    }
  }

  const filteredEmployes = userRole === 'gestionnaire' && userDeptId
    ? employes.filter(e => e.departement_id === userDeptId)
    : employes

  const filteredDepartements = userRole === 'gestionnaire' && userDeptId
    ? departements.filter(d => d.id === userDeptId)
    : departements

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-gray-500">Chargement...</div>
      </div>
    )
  }

  if (!formation) {
    return (
      <div className="p-8">
        <div className="text-red-500">Formation introuvable.</div>
        <Link href="/admin/formations" className="text-indigo-600 hover:underline mt-2 inline-block">
          ← Retour aux formations
        </Link>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <Link href="/admin/formations" className="text-sm text-indigo-600 hover:underline">
          ← Retour aux formations
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Assigner une formation</h1>
        <p className="text-gray-500 text-sm mt-1">
          <span className="font-medium text-gray-700">{formation.titre}</span>
          {formation.categorie && <span className="ml-2 text-gray-400">• {formation.categorie}</span>}
        </p>
      </div>

      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        {/* Type d'assignation */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">Type d'assignation</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="type"
                value="departement"
                checked={type === 'departement'}
                onChange={() => {
                  setType('departement')
                  const defaultDept = userRole === 'gestionnaire' && userDeptId
                    ? userDeptId
                    : filteredDepartements[0]?.id || ''
                  setCibleId(defaultDept)
                }}
                className="text-indigo-600"
              />
              <span className="text-sm text-gray-700">Département entier</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="type"
                value="employe"
                checked={type === 'employe'}
                onChange={() => {
                  setType('employe')
                  setCibleId(filteredEmployes[0]?.id || '')
                }}
                className="text-indigo-600"
              />
              <span className="text-sm text-gray-700">Employé spécifique</span>
            </label>
          </div>
        </div>

        {/* Sélection département ou employé */}
        <div>
          {type === 'departement' ? (
            <>
              <label className="block text-sm font-medium text-gray-700 mb-1">Département</label>
              {filteredDepartements.length === 0 ? (
                <p className="text-sm text-gray-500 italic">Aucun département disponible</p>
              ) : (
                <select
                  value={cibleId}
                  onChange={e => setCibleId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {filteredDepartements.map(d => (
                    <option key={d.id} value={d.id}>{d.nom}</option>
                  ))}
                </select>
              )}
              <p className="text-xs text-gray-400 mt-1">Tous les employés actifs du département seront assignés.</p>
            </>
          ) : (
            <>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employé</label>
              {filteredEmployes.length === 0 ? (
                <p className="text-sm text-gray-500 italic">Aucun employé disponible</p>
              ) : (
                <select
                  value={cibleId}
                  onChange={e => setCibleId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {filteredEmployes.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.prenom} {e.nom}{e.departement_nom ? ` — ${e.departement_nom}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </>
          )}
        </div>

        {/* Date d'échéance */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date d'échéance (optionnel)</label>
          <input
            type="date"
            value={dateEcheance}
            onChange={e => setDateEcheance(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Boutons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting || !cibleId}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Assignation...' : 'Assigner la formation'}
          </button>
          <Link
            href="/admin/formations"
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Annuler
          </Link>
        </div>
      </form>
    </div>
  )
}
