'use client'
import { useT } from '@/lib/i18n/client'
import { droitsDe, type Droits } from '@/lib/droits'
import ChoixPoste from '@/components/ChoixPoste'
import ChampExterne from '@/components/ChampExterne'
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
    externe?: boolean | null
    organisation?: string | null
    peut_creer_formations?: boolean | null
    peut_suivre_employes?: boolean | null
    peut_valider_formations?: boolean | null
    peut_creer_evenements?: boolean | null
    peut_assigner_externes?: boolean | null
  }
  departements: DepartementOption[]
  modifiable: boolean
  rolesPossibles: Role[]
  cliniquesPossibles: CliniqueEmploye[]
  estGestionnaire: boolean
  afficherAutorisationCreation: boolean
  postes?: { famille: string; postes: string[] }[]
}

export default function EditEmployeForm({ employe, departements, modifiable, rolesPossibles, cliniquesPossibles, estGestionnaire, afficherAutorisationCreation, postes = [] }: Props) {
  const { t } = useT()
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
  const [droits, setDroits] = useState<Droits>(droitsDe(employe))
  const [externe, setExterne] = useState(!!employe.externe)
  const [organisation, setOrganisation] = useState(employe.organisation ?? '')

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
          externe, organisation,
          ...(estGestionnaire ? {} : { departement_id: departementId || null, role, clinique: clinique || null }),
          ...(afficherAutorisationCreation && role === 'gestionnaire' ? droits : {}),
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
      setError(t('Une erreur est survenue. Veuillez réessayer.'))
    } finally {
      setLoading(false)
    }
  }

  const inputCls = "w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
  const labelCls = "block text-sm font-medium text-gray-700 mb-1"

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
        <p className="text-green-800 font-medium">{t('Modifications enregistrées !')}</p>
        <p className="text-green-600 text-sm mt-1">{t('Redirection en cours...')}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
      {!modifiable && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-600">
          {t('Consultation seulement : ce dossier est hors de ce que vous pouvez modifier.')}
        </div>
      )}
      <fieldset disabled={!modifiable} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>{t('Prénom *')}</label>
          <input className={inputCls} value={prenom} onChange={e => setPrenom(e.target.value)} required />
        </div>
        <div>
          <label className={labelCls}>{t('Nom *')}</label>
          <input className={inputCls} value={nom} onChange={e => setNom(e.target.value)} required />
        </div>
      </div>
      <div>
        <label className={labelCls}>{t('Courriel')}</label>
        <input className={inputCls + ' bg-gray-50 text-gray-400 cursor-not-allowed'} value={employe.email} disabled />
        <p className="text-xs text-gray-400 mt-1">{t('Le courriel ne peut pas être modifié')}</p>
      </div>
      <div>
        <label className={labelCls}>{t('Poste')}</label>
        <ChoixPoste className={inputCls} valeur={poste} onChange={setPoste} familles={postes} />
      </div>
      <ChampsAcces
        role={role} clinique={clinique} departementId={departementId}
        setRole={setRole} setClinique={setClinique} setDepartementId={setDepartementId}
        rolesPossibles={rolesPossibles} cliniquesPossibles={cliniquesPossibles}
        departements={departements} estGestionnaire={estGestionnaire}
        disabled={!modifiable} inputCls={inputCls} labelCls={labelCls}
        afficherAutorisationCreation={afficherAutorisationCreation}
        droits={droits} setDroits={setDroits}
      />
      <ChampExterne role={role} clinique={clinique} externe={externe} organisation={organisation}
        setExterne={setExterne} setOrganisation={setOrganisation} inputCls={inputCls} labelCls={labelCls}
        cmcPossible={!estGestionnaire && cliniquesPossibles.includes('CMC')} setClinique={estGestionnaire ? undefined : setClinique} />
      <div className="flex items-center gap-3">
        <input type="checkbox" id="actif" checked={actif} onChange={e => setActif(e.target.checked)}
          className="w-4 h-4 text-indigo-600 rounded border-gray-300" />
        <label htmlFor="actif" className="text-sm font-medium text-gray-700">{t('Employé actif')}</label>
      </div>
      </fieldset>
      <div className="flex gap-3 pt-2">
        {modifiable && <button type="submit" disabled={loading}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
          {loading ? t('Enregistrement...') : t('Enregistrer les modifications')}
        </button>}
        <a href="/admin/employes"
          className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
          {modifiable ? 'Annuler' : 'Retour'}
        </a>
      </div>
    </form>
  )
}
