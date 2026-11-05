// Grande section repliable (élément <details> : fonctionne sans JavaScript).
// « Tout réduire / Tout déplier » (ToutReplier) agit sur toutes les sections de la page.
import type { ReactNode } from 'react'

export default function SectionRepliable({ couleur, icone, pastille, titre, sousTitre, detail, children, ouvert = true }: {
  couleur: string
  icone: ReactNode
  /** Petit code affiché avant le titre (ex. MED) */
  pastille?: string
  titre: ReactNode
  sousTitre?: ReactNode
  /** Info secondaire à droite */
  detail?: ReactNode
  children: ReactNode
  ouvert?: boolean
}) {
  return (
    <details open={ouvert} data-repliable className="group mb-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 select-none [&::-webkit-details-marker]:hidden" style={{ background: `linear-gradient(90deg, ${couleur}1a, ${couleur}05 70%)`, borderLeft: `6px solid ${couleur}` }}>
        <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-white text-2xl shadow-sm" aria-hidden>{icone}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            {pastille && <span className="rounded-md px-2 py-0.5 font-mono text-sm font-extrabold text-white" style={{ background: couleur }}>{pastille}</span>}
            <span className="text-lg font-extrabold text-gray-900">{titre}</span>
          </span>
          {sousTitre && <span className="mt-0.5 block text-sm text-gray-500">{sousTitre}</span>}
        </span>
        {detail && <span className="hidden text-sm font-semibold sm:block">{detail}</span>}
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm transition-transform group-open:rotate-180" aria-hidden>▾</span>
      </summary>
      <div className="border-t border-gray-100">{children}</div>
    </details>
  )
}
