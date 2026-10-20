'use client'
// Menu latéral adaptable : barre fixe sur ordinateur, tiroir à ouvrir (☰) sur téléphone et petite tablette.
// Le tiroir se referme à chaque changement de page, avec la touche Échap ou en touchant l'arrière-plan.
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useT } from '@/lib/i18n/client'

type Props = {
  /** Classe du <aside> (styles propres à l'espace admin ou employé). */
  classe: string
  /** Fond du menu et de la barre du haut sur téléphone. */
  fond: string
  titre: string
  children: React.ReactNode
}

export function TiroirMenu({ classe, fond, titre, children }: Props) {
  const [ouvert, setOuvert] = useState(false)
  const chemin = usePathname()
  const { t } = useT()

  useEffect(() => { setOuvert(false) }, [chemin])

  useEffect(() => {
    if (!ouvert) return
    const echap = (e: KeyboardEvent) => { if (e.key === 'Escape') setOuvert(false) }
    document.addEventListener('keydown', echap)
    const defilement = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', echap); document.body.style.overflow = defilement }
  }, [ouvert])

  return (
    <>
      <div className="tiroir-barre" style={{ background: fond }}>
        <button type="button" className="tiroir-bouton" aria-label={ouvert ? t('Fermer le menu') : t('Ouvrir le menu')}
          aria-expanded={ouvert} aria-controls="menu-principal" onClick={() => setOuvert(o => !o)}>
          <span aria-hidden="true">{ouvert ? '✕' : '☰'}</span>
        </button>
        <span className="tiroir-titre">{titre}</span>
      </div>
      {ouvert && <div className="tiroir-fond" onClick={() => setOuvert(false)} aria-hidden="true" />}
      <aside id="menu-principal" className={`${classe} tiroir-menu${ouvert ? ' tiroir-ouvert' : ''}`} style={{ background: fond }}>
        {children}
      </aside>
    </>
  )
}
