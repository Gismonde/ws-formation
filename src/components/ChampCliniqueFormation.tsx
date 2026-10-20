'use client'

import { useEffect, useState } from 'react'
import { CLINIQUE_CONTENU_LABEL, type CliniqueContenu } from '@/lib/cliniques'

/**
 * Liste « Clinique » d'un formulaire de formation.
 * Ne propose que les cliniques que l'utilisateur peut gérer ; choisit la première par défaut.
 */
export function ChampCliniqueFormation({ valeur, onChange, style, labelStyle }: {
  valeur: CliniqueContenu | null
  onChange: (c: CliniqueContenu) => void
  style?: React.CSSProperties
  labelStyle?: React.CSSProperties
}) {
  const [options, setOptions] = useState<CliniqueContenu[] | null>(null)

  useEffect(() => {
    let actif = true
    fetch('/api/espace').then(r => r.ok ? r.json() : { gerables: [] }).then(d => {
      if (!actif) return
      const g: CliniqueContenu[] = d.gerables ?? []
      setOptions(g)
      if (g.length && !valeur) onChange(g[0])
    }).catch(() => actif && setOptions([]))
    return () => { actif = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <label style={labelStyle}>Clinique *</label>
      <select
        style={style}
        value={valeur ?? ''}
        onChange={e => onChange(e.target.value as CliniqueContenu)}
        disabled={!options || options.length === 0}
      >
        {!options && <option value="">Chargement…</option>}
        {options && options.length === 0 && <option value="">Aucune clinique autorisée</option>}
        {valeur && options && !options.includes(valeur) && <option value={valeur} disabled>{CLINIQUE_CONTENU_LABEL[valeur]}</option>}
        {options?.map(c => <option key={c} value={c}>{CLINIQUE_CONTENU_LABEL[c]}</option>)}
      </select>
      <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Seuls les employés de cette clinique pourront voir la formation.</div>
    </div>
  )
}
