'use client'
import { useT } from '@/lib/i18n/client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

import ChampsAcces, { DepartementOption } from '@/components/ChampsAcces'
import ChoixPoste from '@/components/ChoixPoste'
import ChampExterne from '@/components/ChampExterne'
import { AUCUN_DROIT, type Droits } from '@/lib/droits'
import { CliniqueEmploye, Role } from '@/lib/cliniques'

interface Props {
  departements: DepartementOption[]
  rolesPossibles: Role[]
  cliniquesPossibles: CliniqueEmploye[]
  estGestionnaire: boolean
  cliniqueParDefaut: string
  departementParDefaut: string
  afficherAutorisationCreation: boolean
  postes: { famille: string; postes: string[] }[]
}

export default function NouvelEmployeForm({ departements, rolesPossibles, cliniquesPossibles, estGestionnaire, cliniqueParDefaut, departementParDefaut, afficherAutorisationCreation, postes }: Props) {
  const { t } = useT()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<null | { courrielEnvoye: boolean; lien: string | null; employeId: string | null }>(null)
  const [copie, setCopie] = useState(false)
  const [form, setForm] = useState({
    prenom: '', nom: '', email: '',
    role: 'employe', departement_id: departementParDefaut, poste: '', clinique: cliniqueParDefaut
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const [droits, setDroits] = useState<Droits>({ ...AUCUN_DROIT })
  const [externe, setExterne] = useState(false)
  const [organisation, setOrganisation] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/create-employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, externe, organisation, ...(afficherAutorisationCreation && form.role === 'gestionnaire' ? droits : {}) })
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setSuccess({ courrielEnvoye: !!data.courrielEnvoye, lien: data.lienInvitation ?? null, employeId: data.employeId ?? null })
        if (data.courrielEnvoye) setTimeout(() => router.push('/admin/employes'), 2500)
      }
    } catch (err) {
      console.error('handleSubmit error:', err)
      setError(t('Une erreur est survenue. Veuillez réessayer.'))
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-6">
        <p className="text-green-800 font-semibold text-center">{externe ? t('Membre externe créé avec succès !') : t('Employé créé avec succès !')}</p>
        {success.courrielEnvoye ? (
          <p className="text-green-700 text-sm mt-2 text-center">
            {t('📧 Un courriel d’invitation a été envoyé à')} <b>{form.email}</b> {t('pour qu’il crée son mot de passe.')}
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
              Le courriel n’a pas pu être envoyé automatiquement (envoi de courriels non configuré). Transmettez ce lien personnel à l’employé
              pour qu’il crée son mot de passe :
            </p>
            {success.lien && (
              <div className="flex gap-2">
                <input readOnly value={success.lien} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white" onFocus={e => e.target.select()} />
                <button type="button" onClick={() => { navigator.clipboard.writeText(success.lien!); setCopie(true) }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">{copie ? t('Copié ✓') : t('Copier')}</button>
              </div>
            )}
          </div>
        )}
        <div className="flex justify-center gap-3 mt-5">
          {success.employeId && <a href={`/admin/employes/${success.employeId}`} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white">{t('Voir le dossier')}</a>}
          <a href="/admin/employes" className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm">{t('Retour aux employés')}</a>
        </div>
      </div>
    )
  }

  const inputCls = "w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
  const labelCls = "block text-sm font-medium text-gray-700 mb-1"

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>{t('Prénom *')}</label>
          <input className={inputCls} value={form.prenom} onChange={e => set('prenom', e.target.value)} required />
        </div>
        <div>
          <label className={labelCls}>{t('Nom *')}</label>
          <input className={inputCls} value={form.nom} onChange={e => set('nom', e.target.value)} required />
        </div>
      </div>
      <div>
        <label className={labelCls}>{t('Courriel *')}</label>
        <input type="email" className={inputCls} value={form.email} onChange={e => set('email', e.target.value)} required />
      </div>
      <p className="text-xs text-gray-500 -mt-2">
        {t('📧 L’employé recevra un courriel avec un lien pour créer lui-même son mot de passe.')}
      </p>
      <div>
        <label className={labelCls}>{t('Poste / Titre')}</label>
        <ChoixPoste className={inputCls} valeur={form.poste} onChange={v => set('poste', v)} familles={postes} />
      </div>
      <ChampsAcces
        role={form.role} clinique={form.clinique} departementId={form.departement_id}
        setRole={v => set('role', v)} setClinique={v => set('clinique', v)} setDepartementId={v => set('departement_id', v)}
        rolesPossibles={rolesPossibles} cliniquesPossibles={cliniquesPossibles}
        departements={departements} estGestionnaire={estGestionnaire}
        inputCls={inputCls} labelCls={labelCls}
        afficherAutorisationCreation={afficherAutorisationCreation}
        droits={droits} setDroits={setDroits}
      />
      <ChampExterne role={form.role} clinique={form.clinique} externe={externe} organisation={organisation}
        setExterne={setExterne} setOrganisation={setOrganisation} inputCls={inputCls} labelCls={labelCls} />
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
          {loading ? t('Création en cours...') : t('Créer l’employé')}
        </button>
        <a href="/admin/employes"
          className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
          {t('Annuler')}
        </a>
      </div>
    </form>
  )
}
