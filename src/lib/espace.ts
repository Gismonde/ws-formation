// Espace employé actif (CMC / WSSC) — côté serveur.
import { cookies } from 'next/headers'
import {
  Clinique, CliniqueContenu, ESPACE_COOKIE,
  cliniquesContenuDeLEspace, espaceActif, espacesPossibles,
} from '@/lib/cliniques'

export type Espace = {
  /** Espace affiché (null : employé sans clinique) */
  actif: Clinique | null
  /** Espaces que l'employé peut ouvrir (2 = afficher le sélecteur) */
  possibles: Clinique[]
  /** Valeurs de formations.clinique / sop.clinique à afficher dans cet espace */
  cliniquesContenu: CliniqueContenu[]
}

export async function getEspace(employe: { clinique?: string | null; role?: string | null } | null | undefined): Promise<Espace> {
  const store = await cookies()
  const choix = store.get(ESPACE_COOKIE)?.value ?? null
  const possibles = espacesPossibles(employe?.clinique, employe?.role)
  const actif = espaceActif(employe?.clinique, employe?.role, choix)
  return { actif, possibles, cliniquesContenu: cliniquesContenuDeLEspace(actif) }
}
