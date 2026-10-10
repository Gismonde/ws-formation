'use client'

import { CLINIQUE_EMPLOYE_LABEL, ROLE_LABEL, CliniqueEmploye, Role, cliniquesDe } from '@/lib/cliniques'

export interface DepartementOption { id: string; nom: string; clinique: string | null }

interface Props {
  role: string
  clinique: string
  departementId: string
  setRole: (v: string) => void
  setClinique: (v: string) => void
  setDepartementId: (v: string) => void
  rolesPossibles: Role[]
  cliniquesPossibles: CliniqueEmploye[]
  departements: DepartementOption[]
  estGestionnaire: boolean
  disabled?: boolean
  inputCls: string
  labelCls: string
}

const AIDE_ROLE: Record<Role, string> = {
  super_admin: 'Accès complet aux deux cliniques.',
  admin: 'Accès complet, limité à la clinique choisie.',
  gestionnaire: 'Gère les employés de son département et peut en créer.',
  employe: 'Accès à son propre profil et à ses formations.',
}

/** Champs Clinique / Département / Rôle, filtrés selon les droits de la personne connectée. */
export default function ChampsAcces(p: Props) {
  // Gestionnaire : tout est imposé par son département
  if (p.estGestionnaire) {
    const dept = p.departements.find(d => d.id === p.departementId) ?? p.departements[0]
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
        Rôle : <strong>Employé</strong> · Département : <strong>{dept?.nom ?? '—'}</strong>
        {dept?.clinique && <> · Clinique : <strong>{dept.clinique}</strong></>}
        <p className="text-xs text-gray-400 mt-1">En tant que gestionnaire, vous gérez uniquement les employés de votre département.</p>
      </div>
    )
  }

  const roles = p.rolesPossibles.includes(p.role as Role) ? p.rolesPossibles : [p.role as Role, ...p.rolesPossibles]
  const cliniques = !p.clinique || p.cliniquesPossibles.includes(p.clinique as CliniqueEmploye)
    ? p.cliniquesPossibles
    : [p.clinique as CliniqueEmploye, ...p.cliniquesPossibles]
  const cliniquesChoisies = cliniquesDe(p.clinique)
  const depts = p.departements.filter(d =>
    d.id === p.departementId || (p.clinique ? (d.clinique ? cliniquesChoisies.includes(d.clinique as 'CMC' | 'WSSC') : true) : !d.clinique)
  )

  function changerClinique(v: string) {
    p.setClinique(v)
    const actuel = p.departements.find(d => d.id === p.departementId)
    if (actuel?.clinique && !cliniquesDe(v).includes(actuel.clinique as 'CMC' | 'WSSC')) p.setDepartementId('')
  }

  return (
    <>
      <div>
        <label className={p.labelCls}>Clinique {p.role !== 'super_admin' && '*'}</label>
        <select className={p.inputCls} value={p.clinique} onChange={e => changerClinique(e.target.value)}
          disabled={p.disabled} required={p.role !== 'super_admin'}>
          <option value="">{p.role === 'super_admin' ? 'Aucune (accès global)' : '-- Choisir une clinique --'}</option>
          {cliniques.map(c => (
            <option key={c} value={c} disabled={!p.cliniquesPossibles.includes(c)}>{CLINIQUE_EMPLOYE_LABEL[c]}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={p.labelCls}>Département {p.role === 'gestionnaire' && '*'}</label>
        <select className={p.inputCls} value={p.departementId} onChange={e => p.setDepartementId(e.target.value)}
          disabled={p.disabled || (!p.clinique && p.role !== 'super_admin')} required={p.role === 'gestionnaire'}>
          <option value="">-- Aucun département --</option>
          {depts.map(d => (
            <option key={d.id} value={d.id}>{d.nom}{d.clinique ? ` (${d.clinique})` : ' (clinique non définie)'}</option>
          ))}
        </select>
        {!p.clinique && p.role !== 'super_admin' && <p className="text-xs text-gray-400 mt-1">Choisissez d&apos;abord une clinique.</p>}
      </div>
      <div>
        <label className={p.labelCls}>Rôle</label>
        <select className={p.inputCls} value={p.role} onChange={e => p.setRole(e.target.value)} disabled={p.disabled}>
          {roles.map(r => (
            <option key={r} value={r} disabled={!p.rolesPossibles.includes(r)}>{ROLE_LABEL[r] ?? r}</option>
          ))}
        </select>
        {AIDE_ROLE[p.role as Role] && <p className="text-xs text-gray-400 mt-1">{AIDE_ROLE[p.role as Role]}</p>}
      </div>
    </>
  )
}
