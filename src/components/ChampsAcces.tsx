'use client'

import { useT } from '@/lib/i18n/client'
import { CLINIQUE_EMPLOYE_LABEL, ROLE_LABEL, CliniqueEmploye, Role } from '@/lib/cliniques'
import { DROITS_GESTIONNAIRE, droitOffert, type Droits } from '@/lib/droits'

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
  /** Droits du gestionnaire (cases visibles pour les admins quand le rôle est gestionnaire) */
  afficherAutorisationCreation?: boolean
  droits?: Droits
  setDroits?: (d: Droits) => void
  inputCls: string
  labelCls: string
}

const AIDE_ROLE: Record<Role, string> = {
  super_admin: 'Accès complet aux deux cliniques.',
  admin: 'Accès complet, limité à la clinique choisie.',
  gestionnaire: 'Accès à l’admin selon les droits cochés ci-dessous. Sans aucun droit : portail employé avec le titre de gestionnaire.',
  employe: 'Accès à son propre profil et à ses formations.',
}

/** Champs Clinique / Département / Rôle, filtrés selon les droits de la personne connectée. */
export default function ChampsAcces(p: Props) {
  const { t } = useT()
  // Gestionnaire : tout est imposé par son département
  if (p.estGestionnaire) {
    const dept = p.departements.find(d => d.id === p.departementId) ?? p.departements[0]
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
        {t('Rôle :')} <strong>{t('Employé')}</strong> {t('· Clinique :')} <strong>{p.clinique ? CLINIQUE_EMPLOYE_LABEL[p.clinique as CliniqueEmploye] : '—'}</strong> {t('· Département :')} <strong>{dept?.nom ?? '—'}</strong>
        <p className="text-xs text-gray-400 mt-1">{t('En tant que gestionnaire, vous gérez uniquement les employés de votre département.')}</p>
      </div>
    )
  }

  const roles = p.rolesPossibles.includes(p.role as Role) ? p.rolesPossibles : [p.role as Role, ...p.rolesPossibles]
  const cliniques = !p.clinique || p.cliniquesPossibles.includes(p.clinique as CliniqueEmploye)
    ? p.cliniquesPossibles
    : [p.clinique as CliniqueEmploye, ...p.cliniquesPossibles]
  // Les départements sont communs aux deux cliniques : une seule liste, sans doublon
  const depts = p.departements
  const changerClinique = (v: string) => p.setClinique(v)

  return (
    <>
      <div>
        <label className={p.labelCls}>{t('Clinique')}{' '}{p.role !== 'super_admin' && '*'}</label>
        <select className={p.inputCls} value={p.clinique} onChange={e => changerClinique(e.target.value)}
          disabled={p.disabled} required={p.role !== 'super_admin'}>
          <option value="">{p.role === 'super_admin' ? t('Les deux cliniques (accès global)') : t('-- Choisir une clinique --')}</option>
          {cliniques.map(c => (
            <option key={c} value={c} disabled={!p.cliniquesPossibles.includes(c)}>{CLINIQUE_EMPLOYE_LABEL[c]}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={p.labelCls}>{t('Département')}{' '}{p.role === 'gestionnaire' && '*'}</label>
        <select className={p.inputCls} value={p.departementId} onChange={e => p.setDepartementId(e.target.value)}
          disabled={p.disabled || (!p.clinique && p.role !== 'super_admin')} required={p.role === 'gestionnaire'}>
          <option value="">{t('-- Aucun département --')}</option>
          {depts.map(d => (
            <option key={d.id} value={d.id}>{d.nom}</option>
          ))}
        </select>
        {!p.clinique && p.role !== 'super_admin' && <p className="text-xs text-gray-400 mt-1">Choisissez d&apos;abord une clinique.</p>}
      </div>
      <div>
        <label className={p.labelCls}>{t('Rôle')}</label>
        <select className={p.inputCls} value={p.role} onChange={e => p.setRole(e.target.value)} disabled={p.disabled}>
          {roles.map(r => (
            <option key={r} value={r} disabled={!p.rolesPossibles.includes(r)}>{t(ROLE_LABEL[r] ?? r)}</option>
          ))}
        </select>
        {AIDE_ROLE[p.role as Role] && <p className="text-xs text-gray-400 mt-1">{t(AIDE_ROLE[p.role as Role])}</p>}
      </div>
      {p.afficherAutorisationCreation && p.role === 'gestionnaire' && p.droits && (
        <fieldset className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 space-y-2">
          <legend className="text-sm font-semibold text-gray-800 px-1">{t('Droits du gestionnaire')}</legend>
          {DROITS_GESTIONNAIRE.filter(d => droitOffert(d, p.clinique)).map(d => (
            <label key={d.cle} className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" className="mt-0.5 w-4 h-4" disabled={p.disabled}
                checked={p.droits![d.cle]} onChange={e => p.setDroits?.({ ...p.droits!, [d.cle]: e.target.checked })} />
              <span className="text-sm text-gray-700">
                <strong>{t(d.libelle)}</strong>
                <span className="block text-xs text-gray-500 mt-0.5">{t(d.aide)}</span>
              </span>
            </label>
          ))}
          {!Object.values(p.droits).some(Boolean) && (
            <p className="text-xs text-amber-700">{t('Aucun droit coché : cette personne n’aura pas accès à l’admin (portail employé, avec le titre de gestionnaire).')}</p>
          )}
        </fieldset>
      )}
    </>
  )
}
