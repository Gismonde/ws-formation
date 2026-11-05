'use client'
// Catégorie de formation : les catégories de la librairie (Librairie → Catégories), les catégories déjà utilisées,
// et la saisie libre pour en créer une nouvelle. Renommer une catégorie de la librairie renomme aussi les formations.
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
  const [librairie, setLibrairie] = useState<string[] | null>(null)
  useEffect(() => {
    createClient().from('formations').select('categorie').then(({ data }) => {
      setExistantes((data ?? []).map(f => f.categorie as string | null).filter((c): c is string => !!c))
    })
    fetch('/api/admin/librairie/categories').then(r => r.ok ? r.json() : null)
      .then(d => setLibrairie(Array.isArray(d?.categories) ? d.categories.map((c: { nom: string }) => c.nom) : []))
      .catch(() => setLibrairie([]))
  }, [])
  // Catégories gérées dans la librairie ; la liste par défaut seulement si la librairie n'en a aucune
  const base = librairie && librairie.length ? librairie : CATEGORIES_FORMATION
  const toutes = Array.from(new Set([...base, ...existantes])).sort((a, b) => a.localeCompare(b, 'fr'))
  return (
    <>
      <input list={id} value={valeur} onChange={e => onChange(e.target.value)} maxLength={80}
        placeholder={t('Choisir ou saisir une nouvelle catégorie')} className={className} style={style} />
      <datalist id={id}>{toutes.map(c => <option key={c} value={c} />)}</datalist>
    </>
  )
}
