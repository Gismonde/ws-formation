'use client'
// Catégorie de formation : liste des catégories existantes + saisie libre pour en créer une nouvelle.
import { useT } from '@/lib/i18n/client'
import { useEffect, useState, type CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CATEGORIES_FORMATION } from '@/lib/categories'

export function ChampCategorie({ valeur, onChange, className, style, id = 'categorie-formation' }: {
  valeur: string
  onChange: (v: string) => void
  className?: string
  style?: CSSProperties
  id?: string
}) {
  const { t } = useT()
  const [existantes, setExistantes] = useState<string[]>([])
  useEffect(() => {
    createClient().from('formations').select('categorie').then(({ data }) => {
      setExistantes((data ?? []).map(f => f.categorie as string | null).filter((c): c is string => !!c))
    })
  }, [])
  const toutes = Array.from(new Set([...CATEGORIES_FORMATION, ...existantes])).sort((a, b) => a.localeCompare(b, 'fr'))
  return (
    <>
      <input list={id} value={valeur} onChange={e => onChange(e.target.value)} maxLength={80}
        placeholder={t('Choisir ou saisir une nouvelle catégorie')} className={className} style={style} />
      <datalist id={id}>{toutes.map(c => <option key={c} value={c} />)}</datalist>
    </>
  )
}
