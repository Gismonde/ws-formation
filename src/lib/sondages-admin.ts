// Résultats des sondages pour l'administration (portée de l'acteur, sans nom).
import type { SupabaseClient } from '@supabase/supabase-js'
import { type Acteur, idsEmployesDansPortee, cliniquesContenuVisibles } from '@/lib/permissions'
import { agregerReponses, chargerReponses, sondagesDisponibles, type ResultatsSondage } from '@/lib/sondages'

export type LigneSondage = ResultatsSondage & { titre: string }

export async function chargerResultatsSondages(sb: SupabaseClient, acteur: Acteur): Promise<{ actif: boolean; lignes: LigneSondage[] }> {
  if (!(await sondagesDisponibles(sb))) return { actif: false, lignes: [] }
  const { data: formations } = await sb.from('formations').select('id, titre')
    .in('clinique', cliniquesContenuVisibles(acteur)).order('titre')
  const fs = (formations ?? []) as { id: string; titre: string }[]
  const reponses = await chargerReponses(sb, fs.map(f => f.id), await idsEmployesDansPortee(acteur, sb))
  const lignes = fs
    .map(f => ({ ...agregerReponses(f.id, reponses.filter(r => r.formation_id === f.id)), titre: f.titre }))
    .filter(l => l.reponses > 0)
    .sort((a, b) => b.reponses - a.reponses)
  return { actif: true, lignes }
}
