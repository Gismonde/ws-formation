// En-tête de catégorie de politiques : grande section repliable.
import type { ReactNode } from 'react'
import { couleurCategorie, type CategoriePolitique } from '@/lib/politiques-categories'
import SectionRepliable from '@/components/SectionRepliable'

export default function SectionCategorie({ categorie, titreSans, nombre, detail, children, ouvert = true }: {
  categorie: CategoriePolitique | null
  titreSans: string
  nombre: string
  detail?: ReactNode
  children: ReactNode
  ouvert?: boolean
}) {
  return (
    <SectionRepliable couleur={couleurCategorie(categorie?.code)} icone={categorie?.emoji ?? '📁'} pastille={categorie?.code} titre={categorie ? categorie.nom : titreSans} sousTitre={nombre} detail={detail} ouvert={ouvert}>
      {children}
    </SectionRepliable>
  )
}
