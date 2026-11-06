// Formations en libre accès (« Formations disponibles ») : publiées, ouvertes à tous les employés de l'espace,
// suivies sans assignation obligatoire. Côté serveur.
import type { SupabaseClient } from '@supabase/supabase-js'

export type FormationLibre = {
  id: string; titre: string; description: string | null; categorie: string | null; niveau: string | null
  duree_estimee_minutes: number | null; image_couverture: string | null; inscrit: boolean
}

/** Formations publiées en libre accès de l'espace ; [] tant que la colonne libre_acces n'existe pas. */
export async function formationsLibres(sb: SupabaseClient, employeId: string, cliniques: string[]): Promise<FormationLibre[]> {
  const { data, error } = await sb.from('formations')
    .select('id, titre, description, categorie, niveau, duree_estimee_minutes, image_couverture')
    .eq('publiee', true).eq('libre_acces', true).in('clinique', cliniques)
    .order('titre')
  if (error || !data?.length) return []
  const { data: ass } = await sb.from('assignations').select('formation_id').eq('employe_id', employeId).in('formation_id', data.map(f => f.id))
  const inscrits = new Set((ass ?? []).map(a => a.formation_id as string))
  return data.map(f => ({ ...(f as Omit<FormationLibre, 'inscrit'>), inscrit: inscrits.has(f.id as string) }))
}
