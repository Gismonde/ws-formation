'use client'
import { CLINIQUE_EMPLOYE_LABEL, CliniqueEmploye } from '@/lib/cliniques'

export type Ciblage = { clinique: CliniqueEmploye; tous: boolean; departements: string[] }

/** Choix du public : clinique, puis toute la clinique ou un/plusieurs départements. */
export default function ChampsCiblage({ valeur, onChange, cliniques, departements }: {
  valeur: Ciblage
  onChange: (c: Ciblage) => void
  cliniques: CliniqueEmploye[]
  departements: { id: string; nom: string }[]
}) {
  const basculer = (id: string) => onChange({
    ...valeur,
    departements: valeur.departements.includes(id) ? valeur.departements.filter(d => d !== id) : [...valeur.departements, id],
  })
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Clinique *</label>
        <div className="flex flex-wrap gap-2">
          {cliniques.map(c => (
            <button key={c} type="button" onClick={() => onChange({ ...valeur, clinique: c })}
              className={'px-4 py-2 rounded-lg text-sm border ' + (valeur.clinique === c ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400')}>
              {CLINIQUE_EMPLOYE_LABEL[c]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">S’adresse à *</label>
        <div className="flex flex-wrap gap-2 mb-3">
          <button type="button" onClick={() => onChange({ ...valeur, tous: true })}
            className={'px-4 py-2 rounded-lg text-sm border ' + (valeur.tous ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300')}>
            Toute la clinique
          </button>
          <button type="button" onClick={() => onChange({ ...valeur, tous: false })}
            className={'px-4 py-2 rounded-lg text-sm border ' + (!valeur.tous ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300')}>
            Certains départements
          </button>
        </div>
        {!valeur.tous && (
          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-gray-500">{valeur.departements.length} département(s) sélectionné(s)</span>
              <span className="text-xs space-x-3">
                <button type="button" className="text-blue-600 hover:underline" onClick={() => onChange({ ...valeur, departements: departements.map(d => d.id) })}>Tout cocher</button>
                <button type="button" className="text-blue-600 hover:underline" onClick={() => onChange({ ...valeur, departements: [] })}>Aucun</button>
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {departements.map(d => (
                <label key={d.id} className="flex items-center gap-2 text-sm text-gray-800 bg-white border border-gray-200 rounded-md px-3 py-2 cursor-pointer hover:border-blue-300">
                  <input type="checkbox" checked={valeur.departements.includes(d.id)} onChange={() => basculer(d.id)} />
                  {d.nom}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
