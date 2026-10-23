// Prérequis bloquants : une formation ne s'ouvre que lorsque ses prérequis (formations.prerequis_ids)
// sont terminés ou certifiés. Côté serveur uniquement.
import type { SupabaseClient } from '@supabase/supabase-js'
import { chargerEtatsFormations, estComplete, LIBELLE_STATUT, type StatutFormation } from '@/lib/etat-formations'

export type PrerequisManquant = {
  id: string
  titre: string
  statut: StatutFormation
  libelle_statut: string
  progression: number
  assigne: boolean
}

/** Prérequis non complétés par l'employé pour cette formation ([] = la formation est accessible). */
export async function prerequisManquants(sb: SupabaseClient, employeId: string, formationId: string): Promise<PrerequisManquant[]> {
  const { data: formation } = await sb.from('formations').select('prerequis_ids').eq('id', formationId).maybeSingle()
  const propres = ((formation?.prerequis_ids ?? []) as string[]).filter(id => id && id !== formationId)
  // Parcours (journée de formation à ordre imposé) : les formations qui précèdent celle-ci dans le parcours
  const parcours = await precedentesDansParcours(sb, employeId, formationId)
  const ids = Array.from(new Set([...propres, ...parcours]))
  if (ids.length === 0) return []

  // Un prérequis dépublié ou supprimé ne bloque personne (il ne pourrait jamais être terminé)
  const [{ data: prerequis }, { data: assignations }] = await Promise.all([
    sb.from('formations').select('id, titre').in('id', ids).eq('publiee', true),
    sb.from('assignations').select('formation_id').eq('employe_id', employeId).in('formation_id', ids),
  ])
  if (!prerequis?.length) return []
  const assignes = new Set((assignations ?? []).map(a => a.formation_id as string))
  const etat = await chargerEtatsFormations(sb, [employeId], prerequis.map(p => p.id as string))

  return prerequis
    .map(p => ({ p, e: etat(employeId, p.id as string) }))
    .filter(({ e }) => !estComplete(e.statut))
    .map(({ p, e }) => ({
      id: p.id as string,
      titre: p.titre as string,
      statut: e.statut,
      libelle_statut: LIBELLE_STATUT[e.statut],
      progression: e.progression,
      assigne: assignes.has(p.id as string),
    }))
    // Dans l'ordre choisi par l'administrateur
    .sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
}

/** Formations placées avant celle-ci dans les journées à ordre imposé lancées pour l'employé */
export async function precedentesDansParcours(sb: SupabaseClient, employeId: string, formationId: string): Promise<string[]> {
  const { data, error } = await sb.from('journees_formation').select('formation_ids')
    .eq('modele', false).eq('ordre_impose', true).contains('employe_ids', [employeId]).contains('formation_ids', [formationId])
  if (error) return [] // colonne pas encore créée : pas d'ordre imposé
  return (data ?? []).flatMap(j => {
    const liste = (j.formation_ids ?? []) as string[]
    return liste.slice(0, liste.indexOf(formationId))
  })
}

/** Message d'erreur court pour les API. */
export function messagePrerequis(manquants: PrerequisManquant[]): string {
  return `Terminez d’abord ${manquants.length > 1 ? 'les formations préalables' : 'la formation préalable'} : ${manquants.map(m => `« ${m.titre} »`).join(', ')}.`
}
