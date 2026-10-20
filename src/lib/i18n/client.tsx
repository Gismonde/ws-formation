'use client'
// Langue de l'interface côté client : fournie par le layout racine, lue avec useT().
import { createContext, useContext, useMemo } from 'react'
import { locale, traducteur, type Langue, type Traducteur } from './base'

const Contexte = createContext<Langue>('fr')

export function FournisseurLangue({ langue, children }: { langue: Langue; children: React.ReactNode }) {
  return <Contexte.Provider value={langue}>{children}</Contexte.Provider>
}

export function useLangue(): Langue {
  return useContext(Contexte)
}

export function useT(): { langue: Langue; t: Traducteur; loc: string } {
  const langue = useContext(Contexte)
  return useMemo(() => ({ langue, t: traducteur(langue), loc: locale(langue) }), [langue])
}
