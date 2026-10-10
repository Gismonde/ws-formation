'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ChampsAcces, { DepartementOption } from '@/components/ChampsAcces'
import { CliniqueEmploye, Role } from '@/lib/cliniques'

interface Props {
  employe: {
    id: string
    prenom: string
    nom: string
    email: string
    poste: string | null
    role: string
    actif: boolean
    departement_id: string | null
    clinique: string | null
    peut_creer_formations?: boolean | null
  }
  departements: DepartementOption[]
  modifiable: boolean
  rolesPossibles: Role[]
  cliniquesPossibles: CliniqueEmploye[]
  estGestionnaire: boolean
  afficherAutorisationCreation: boolean
}

export default function EditEmployeForm({ employe, departements, modifiable, rolesPossibles, cliniquesPossibles, estGestionnaire, afficherAutorisationCreation }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [prenom, setPrenom] = useState(employe.prenom || '')
  const [nom, setNom] = useState(employe.nom || '')
  const [poste, setPoste] = useState(employe.poste || '')
  const [role, setRole] = useState(employe.role || 'employe')
  const [departementId, setDepartementId] = useState(employe.departement_id || '')
  const [clinique, setClinique] = useState(employe.clinique || '')
  const [actif, setActif] = useState(employe.actif)
  const [peutCreer, setPeutCreer] = useState(employe.peut_creer_formations === true)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/update-employee', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: employe.id,
          prenom,
          nom,
          poste: poste || null,
          ...(estGestionnaire ? {} : { departement_id: departementId || null, role, clinique: clinique || null }),
          ...(afficherAutorisationCreation ? { peut_creer_formations: role === 'gestionnaire' && peutCreer } : {}),
          actif
        })
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setSuccess(true)
        setTimeout(() => router.push('/admin/employes'), 1500)
      }
    } catch (err) {
      console.error('handleSubmit error:', err)
      setError('Une erreur est survenue. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = "w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
  const labelCls = "block text-sm font-medium text-gray-700 mb-1"

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
        <p className="text-green-800 font-medium">Modifications enregistrées !</p>
        <p className="text-green-600 text-sm mt-1">Redirection en cours...</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
      {!modifiable && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-600">
          Consultation seulement : ce dossier est hors de ce que vous pouvez modifier.
        </div>
      )}
      <fieldset disabled={!modifiable} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Prénom *</label>
          <input className={inputCls} value={prenom} onChange={e => setPrenom(e.target.value)} required />
        </div>
        <div>
          <label className={labelCls}>Nom *</label>
          <input className={inputCls} value={nom} onChange={e => setNom(e.target.value)} required />
        </div>
      </div>
      <div>
        <label className={labelCls}>Courriel</label>
        <input className={inputCls + ' bg-gray-50 text-gray-400 cursor-not-allowed'} value={employe.email} disabled />
        <p className="text-xs text-gray-400 mt-1">Le courriel ne peut pas être modifié</p>
      </div>
      <div>
        <label className={labelCls}>Poste</label>
        <input className={inputCls} value={poste} onChange={e => setPoste(e.target.value)} placeholder="Ex : Infirmier(e)..." />
      </div>
      <ChampsAcces
        role={role} clinique={clinique} departementId={departementId}
        setRole={setRole} setClinique={setClinique} setDepartementId={setDepartementId}
        rolesPossibles={rolesPossibles} cliniquesPossibles={cliniquesPossibles}
        departements={departements} estGestionnaire={estGestionnaire}
        disabled={!modifiable} inputCls={inputCls} labelCls={labelCls}
        afficherAutorisationCreation={afficherAutorisationCreation}
        peutCreerFormations={peutCreer} setPeutCreerFormations={setPeutCreer}
      />
      <div className="flex items-center gap-3">
        <input type="checkbox" id="actif" checked={actif} onChange={e => setActif(e.target.checked)}
          className="w-4 h-4 text-blue-600 rounded border-gray-300" />
        <label htmlFor="actif" className="text-sm font-medium text-gray-700">Employé actif</label>
      </div>
      </fieldset>
      <div className="flex gap-3 pt-2">
        {modifiable && <button type="submit" disabled={loading}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
          {loading ? 'Enregistrement...' : 'Enregistrer les modifications'}
        </button>}
        <a href="/admin/employes"
          className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
          {modifiable ? 'Annuler' : 'Retour'}
        </a>
      </div>
    </form>
  )
}
