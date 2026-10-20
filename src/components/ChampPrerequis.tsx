'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Choix des prérequis bloquants d'une formation : l'employé ne pourra l'ouvrir
 * qu'après avoir terminé (ou été certifié pour) les formations cochées.
 */
export function ChampPrerequis({ formationId, valeur, onChange }: {
  formationId?: string
  valeur: string[]
  onChange: (ids: string[]) => void
}) {
  const [formations, setFormations] = useState<{ id: string; titre: string }[] | null>(null)

  useEffect(() => {
    createClient().from('formations').select('id, titre, prerequis_ids').eq('publiee', true).order('titre')
      // Exclut la formation elle-même et celles qui l'ont déjà en prérequis (sinon blocage mutuel)
      .then(({ data }) => setFormations((data ?? []).filter(f => f.id !== formationId && !(formationId && (f.prerequis_ids ?? []).includes(formationId)))))
  }, [formationId])

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Prérequis bloquants</label>
      <p className="text-xs text-gray-500 mb-2">
        L&apos;employé ne pourra ouvrir cette formation qu&apos;après avoir terminé les formations cochées.
        Pensez à les lui assigner aussi.
      </p>
      {formations === null ? (
        <p className="text-xs text-gray-400">Chargement…</p>
      ) : formations.length === 0 ? (
        <p className="text-xs text-gray-400 italic">Aucune autre formation publiée.</p>
      ) : (
        <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
          {formations.map(f => (
            <label key={f.id} className="flex items-center gap-2 text-sm cursor-pointer text-gray-700">
              <input
                type="checkbox"
                checked={valeur.includes(f.id)}
                onChange={e => onChange(e.target.checked ? [...valeur, f.id] : valeur.filter(id => id !== f.id))}
              />
              {f.titre}
            </label>
          ))}
        </div>
      )}
      {valeur.length > 0 && <p className="text-xs text-amber-700 mt-1">🔒 {valeur.length} prérequis bloquant{valeur.length > 1 ? 's' : ''}</p>}
    </div>
  )
}
