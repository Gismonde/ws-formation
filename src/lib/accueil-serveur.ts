// Lecture / écriture de la page d'accueil d'une clinique (table pages_accueil). Côté serveur.
// La colonne contenu porte la version française ; la version anglaise, si elle a été personnalisée, est rangée sous « en ».
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Clinique } from '@/lib/cliniques'
import { accueilParDefaut, validerContenu, type ContenuAccueil } from '@/lib/accueil'
import type { Langue } from '@/lib/i18n/base'

export type PageAccueil = { contenu: ContenuAccueil; personnalisee: boolean; modifiee_le: string | null; disponible: boolean }

type Ligne = { contenu: (ContenuAccueil & { en?: unknown }) | null; modifie_le: string | null }

export async function lireLigneAccueil(sb: SupabaseClient, clinique: Clinique): Promise<{ ligne: Ligne | null; disponible: boolean }> {
  const { data, error } = await sb.from('pages_accueil').select('contenu, modifie_le').eq('clinique', clinique).maybeSingle()
  return { ligne: error ? null : (data as Ligne | null), disponible: !error }
}

/** Partie d'une ligne pour une langue, validée ; null si absente ou invalide. */
export function partieAccueil(ligne: Ligne | null, langue: Langue): ContenuAccueil | null {
  if (!ligne?.contenu) return null
  const brut = langue === 'en' ? ligne.contenu.en : ligne.contenu
  if (!brut) return null
  const v = validerContenu(brut)
  return 'erreur' in v ? null : v.contenu
}

export async function chargerAccueil(sb: SupabaseClient, clinique: Clinique, langue: Langue = 'fr'): Promise<PageAccueil> {
  const { ligne, disponible } = await lireLigneAccueil(sb, clinique)
  const partie = partieAccueil(ligne, langue)
  if (!partie) return { contenu: accueilParDefaut(clinique, langue), personnalisee: false, modifiee_le: null, disponible }
  return { contenu: partie, personnalisee: true, modifiee_le: ligne!.modifie_le, disponible }
}
