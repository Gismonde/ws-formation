'use client'
import { useMemo, useState } from 'react'
import { useT } from '@/lib/i18n/client'
import { CLINIQUE_EMPLOYE_LABEL, CliniqueEmploye, cliniquesDe } from '@/lib/cliniques'

export type Ciblage = {
  clinique: CliniqueEmploye
  tous: boolean
  departements: string[]
  employes: string[]
  roles: string[]
  postes: string[]
}

export type EmployeOption = { id: string; nom: string; poste: string | null; clinique: string | null; departement: string | null }

/** Corps envoyé à l'API pour le public choisi. */
export function corpsCiblage(c: Ciblage) {
  return c.tous
    ? { clinique: c.clinique, departements: [], employes: [], roles: [], postes: [] }
    : { clinique: c.clinique, departements: c.departements, employes: c.employes, roles: c.roles, postes: c.postes }
}

export function ciblageVide(c: Ciblage) {
  return !c.tous && !c.departements.length && !c.employes.length && !c.roles.length && !c.postes.length
}

const basculer = (liste: string[], v: string) => (liste.includes(v) ? liste.filter(x => x !== v) : [...liste, v])

/**
 * Choix du public : clinique, puis toute la clinique ou un public ciblé.
 * Public ciblé = les personnes qui correspondent à AU MOINS un critère (département, rôle, poste, employé désigné).
 */
export default function ChampsCiblage({ valeur, onChange, cliniques, departements, postes = [], employes = [], rolesPostes = true }: {
  valeur: Ciblage
  onChange: (c: Ciblage) => void
  cliniques: CliniqueEmploye[]
  departements: { id: string; nom: string }[]
  postes?: string[]
  employes?: EmployeOption[]
  /** Colonnes roles / postes présentes en base */
  rolesPostes?: boolean
}) {
  const { t } = useT()
  const [recherche, setRecherche] = useState('')
  const set = (p: Partial<Ciblage>) => onChange({ ...valeur, ...p })
  const bouton = (actif: boolean) => 'px-4 py-2 rounded-lg text-sm border ' + (actif ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400')
  const carte = 'border border-gray-200 rounded-lg p-3 bg-gray-50'
  const coche = 'flex items-center gap-2 text-sm text-gray-800 bg-white border border-gray-200 rounded-md px-3 py-2 cursor-pointer hover:border-indigo-300'

  // Employés de la clinique choisie, filtrés par la recherche
  const cl = cliniquesDe(valeur.clinique)
  const employesClinique = useMemo(() => employes.filter(e => !e.clinique || e.clinique === 'LES_DEUX' || cl.some(c => c === e.clinique)), [employes, cl])
  const sansAcc = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const trouves = recherche.trim().length >= 2
    ? employesClinique.filter(e => sansAcc(`${e.nom} ${e.poste ?? ''} ${e.departement ?? ''}`).includes(sansAcc(recherche.trim()))).slice(0, 30)
    : []
  const choisis = employes.filter(e => valeur.employes.includes(e.id))

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('Clinique *')}</label>
        <div className="flex flex-wrap gap-2">
          {cliniques.map(c => <button key={c} type="button" onClick={() => set({ clinique: c })} className={bouton(valeur.clinique === c)}>{CLINIQUE_EMPLOYE_LABEL[c]}</button>)}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('S’adresse à *')}</label>
        <div className="flex flex-wrap gap-2 mb-3">
          <button type="button" onClick={() => set({ tous: true })} className={bouton(valeur.tous)}>{t('Toute la clinique')}</button>
          <button type="button" onClick={() => set({ tous: false })} className={bouton(!valeur.tous)}>{t('Un public ciblé')}</button>
        </div>

        {!valeur.tous && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">{t('La politique s’adresse aux personnes qui correspondent à au moins un des critères ci-dessous.')}</p>

            <div className={carte}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">{t('Départements')} <span className="text-xs font-normal text-gray-500">({valeur.departements.length})</span></span>
                <span className="text-xs space-x-3">
                  <button type="button" className="text-indigo-600 hover:underline" onClick={() => set({ departements: departements.map(d => d.id) })}>{t('Tout cocher')}</button>
                  <button type="button" className="text-indigo-600 hover:underline" onClick={() => set({ departements: [] })}>{t('Aucun')}</button>
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {departements.map(d => (
                  <label key={d.id} className={coche}>
                    <input type="checkbox" checked={valeur.departements.includes(d.id)} onChange={() => set({ departements: basculer(valeur.departements, d.id) })} />
                    {d.nom}
                  </label>
                ))}
              </div>
            </div>

            <div className={carte}>
              <span className="block text-sm font-medium text-gray-700 mb-2">{t('Rôles')}</span>
              {rolesPostes ? (
                <div className="flex flex-wrap gap-2">
                  {[['gestionnaire', t('Gestionnaires')], ['admin', t('Administrateurs (clinique et global)')]].map(([v, l]) => (
                    <label key={v} className={coche}>
                      <input type="checkbox" checked={valeur.roles.includes(v)} onChange={() => set({ roles: basculer(valeur.roles, v) })} />
                      {l}
                    </label>
                  ))}
                </div>
              ) : <p className="text-xs text-amber-700">{t('Disponible après la mise à jour de la base de données (politiques_roles_postes.sql).')}</p>}
            </div>

            <div className={carte}>
              <span className="block text-sm font-medium text-gray-700 mb-2">{t('Postes / titres')} <span className="text-xs font-normal text-gray-500">({valeur.postes.length})</span></span>
              {!rolesPostes ? <p className="text-xs text-amber-700">{t('Disponible après la mise à jour de la base de données (politiques_roles_postes.sql).')}</p>
                : postes.length === 0 ? <p className="text-xs text-gray-500">{t('Aucun poste renseigné dans les fiches employés.')}</p> : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto">
                    {postes.map(p => (
                      <label key={p} className={coche}>
                        <input type="checkbox" checked={valeur.postes.includes(p)} onChange={() => set({ postes: basculer(valeur.postes, p) })} />
                        {p}
                      </label>
                    ))}
                  </div>
                )}
            </div>

            <div className={carte}>
              <span className="block text-sm font-medium text-gray-700 mb-2">{t('Employés désignés')} <span className="text-xs font-normal text-gray-500">({valeur.employes.length})</span></span>
              {choisis.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {choisis.map(e => (
                    <span key={e.id} className="inline-flex items-center gap-1 rounded-full bg-indigo-100 text-indigo-800 text-xs px-2.5 py-1">
                      {e.nom}
                      <button type="button" aria-label={t('Retirer')} onClick={() => set({ employes: valeur.employes.filter(x => x !== e.id) })} className="text-indigo-500 hover:text-indigo-900">×</button>
                    </span>
                  ))}
                </div>
              )}
              <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder={t('Rechercher un employé (nom, poste, département)…')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white" />
              {trouves.length > 0 && (
                <div className="mt-2 max-h-56 overflow-y-auto space-y-1">
                  {trouves.map(e => (
                    <label key={e.id} className={coche}>
                      <input type="checkbox" checked={valeur.employes.includes(e.id)} onChange={() => set({ employes: basculer(valeur.employes, e.id) })} />
                      <span>{e.nom}<span className="block text-xs text-gray-500">{[e.poste, e.departement].filter(Boolean).join(' · ')}</span></span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
