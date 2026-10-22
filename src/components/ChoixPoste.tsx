'use client'
// Choix du poste dans la liste officielle (groupée par famille). Un ancien poste hors liste reste affiché.
import { useT } from '@/lib/i18n/client'

export default function ChoixPoste({ valeur, onChange, familles, className }: {
  valeur: string
  onChange: (v: string) => void
  familles: { famille: string; postes: string[] }[]
  className?: string
}) {
  const { t } = useT()
  const connu = familles.some(f => f.postes.includes(valeur))
  // Liste pas encore disponible : saisie libre
  if (familles.length === 0) return <input className={className} value={valeur} onChange={e => onChange(e.target.value)} placeholder={t('Ex : Infirmier(e), Technicien(ne)...')} />
  return (
    <select className={className} value={valeur} onChange={e => onChange(e.target.value)}>
      <option value="">{t('— Aucun poste —')}</option>
      {valeur && !connu && <option value={valeur}>{valeur} ({t('hors liste')})</option>}
      {familles.map(f => (
        <optgroup key={f.famille} label={f.famille}>
          {f.postes.map(p => <option key={p} value={p}>{p}</option>)}
        </optgroup>
      ))}
    </select>
  )
}
