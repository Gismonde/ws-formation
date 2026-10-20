// Lecture / écriture de la page d'accueil d'une clinique (table pages_accueil). Côté serveur.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Clinique } from '@/lib/cliniques'
import { ACCUEIL_PAR_DEFAUT, validerContenu, type ContenuAccueil } from '@/lib/accueil'

export type PageAccueil = { contenu: ContenuAccueil; personnalisee: boolean; modifiee_le: string | null; disponible: boolean }

export async function chargerAccueil(sb: SupabaseClient, clinique: Clinique): Promise<PageAccueil> {
  const { data, error } = await sb.from('pages_accueil').select('contenu, modifie_le').eq('clinique', clinique).maybeSingle()
  if (error) return { contenu: ACCUEIL_PAR_DEFAUT[clinique], personnalisee: false, modifiee_le: null, disponible: false }
  const v = data ? validerContenu(data.contenu) : null
  if (!v || 'erreur' in v) return { contenu: ACCUEIL_PAR_DEFAUT[clinique], personnalisee: false, modifiee_le: null, disponible: true }
  return { contenu: v.contenu, personnalisee: true, modifiee_le: data!.modifie_le, disponible: true }
}
