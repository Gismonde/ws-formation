// En-tête de catégorie bien visible, repliable (élément <details> : fonctionne sans JavaScript).
import type { ReactNode } from 'react'
import { couleurCategorie, type CategoriePolitique } from '@/lib/politiques-categories'

export default function SectionCategorie({ categorie, titreSans, nombre, detail, children, ouvert = true }: {
  categorie: CategoriePolitique | null
  /** Titre de la section « sans catégorie » */
  titreSans: string
  /** Texte « N politique(s) » */
  nombre: string
  /** Info secondaire à droite (ex. « 3 en attente ») */
  detail?: ReactNode
  children: ReactNode
  ouvert?: boolean
}) {
  const c = couleurCategorie(categorie?.code)
  return (
    <details open={ouvert} data-categorie className="group mb-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 select-none [&::-webkit-details-marker]:hidden" style={{ background: `linear-gradient(90deg, ${c}1a, ${c}05 70%)`, borderLeft: `6px solid ${c}` }}>
        <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-2xl shadow-sm" style={{ background: '#fff' }} aria-hidden>{categorie?.emoji ?? '📁'}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            {categorie && <span className="rounded-md px-2 py-0.5 font-mono text-sm font-extrabold text-white" style={{ background: c }}>{categorie.code}</span>}
            <span className="text-lg font-extrabold text-gray-900">{categorie ? categorie.nom : titreSans}</span>
          </span>
          <span className="mt-0.5 block text-sm text-gray-500">{nombre}</span>
        </span>
        {detail && <span className="hidden text-sm font-semibold sm:block">{detail}</span>}
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm transition-transform group-open:rotate-180" aria-hidden>▾</span>
      </summary>
      <div className="border-t border-gray-100">{children}</div>
    </details>
  )
}
