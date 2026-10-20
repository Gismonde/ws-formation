// Expiration des certificats : statut, paliers de rappel et chargement pour l'administration.
// Côté serveur uniquement (le chargement passe par la clé de service + filtres de portée).
import type { SupabaseClient } from '@supabase/supabase-js'
import { type Acteur, filtrerEmployes, cliniquesContenuVisibles } from '@/lib/permissions'
import type { CliniqueContenu } from '@/lib/cliniques'

export type StatutExpiration = 'expire' | 'bientot' | 'valide'

/** Paliers de rappel envoyés à l'employé avant (et le jour de) l'expiration. */
export const PALIERS_RAPPEL_CERTIFICAT = [60, 30, 7, 0] as const
export type PalierRappel = `J-${(typeof PALIERS_RAPPEL_CERTIFICAT)[number]}`

const JOUR = 24 * 60 * 60 * 1000

/** Nombre de jours (entiers) entre aujourd'hui et la date d'expiration (négatif = expiré). */
export function joursRestants(dateExpiration: string, aujourdhui: Date = new Date()): number {
  const fin = new Date(dateExpiration.length === 10 ? dateExpiration + 'T00:00:00' : dateExpiration)
  const debut = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate())
  const finJour = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate())
  return Math.round((finJour.getTime() - debut.getTime()) / JOUR)
}

export function statutExpiration(jours: number, horizon = 60): StatutExpiration {
  if (jours < 0) return 'expire'
  if (jours <= horizon) return 'bientot'
  return 'valide'
}

/**
 * Palier de rappel atteint pour ce nombre de jours restants (null : trop tôt, ou expiré depuis plus d'un jour).
 * Un rappel n'est envoyé qu'une fois par palier : si le service n'a pas tourné un jour, le palier suivant rattrape.
 */
export function palierRappelCertificat(jours: number): PalierRappel | null {
  if (jours < -1) return null
  if (jours <= 0) return 'J-0'
  if (jours <= 7) return 'J-7'
  if (jours <= 30) return 'J-30'
  if (jours <= 60) return 'J-60'
  return null
}

export type LigneExpiration = {
  certificat_id: string
  numero_certificat: string | null
  employe_id: string
  employe_nom: string
  employe_email: string | null
  clinique: string | null
  departement: string | null
  formation_id: string
  formation_titre: string
  formation_clinique: CliniqueContenu | null
  date_emission: string | null
  date_expiration: string
  jours_restants: number
  statut: StatutExpiration
}

type CertRow = {
  id: string; numero_certificat: string | null; employe_id: string; formation_id: string
  date_emission: string | null; date_expiration: string | null; valide: boolean | null
}

/** Certificats à durée limitée des employés visibles par l'acteur, triés du plus urgent au moins urgent. */
export async function chargerExpirations(sb: SupabaseClient, acteur: Acteur, horizon = 60): Promise<LigneExpiration[]> {
  const { data: employes } = await filtrerEmployes(
    sb.from('employes').select('id, prenom, nom, email, clinique, actif, departements(nom), departement'),
    acteur,
  )
  const actifs = (employes ?? []).filter((e: { actif: boolean | null }) => e.actif !== false)
  if (actifs.length === 0) return []
  const parId = new Map(actifs.map((e: Record<string, unknown>) => [e.id as string, e]))

  const { data: certs } = await sb.from('certificats')
    .select('id, numero_certificat, employe_id, formation_id, date_emission, date_expiration, valide')
    .not('date_expiration', 'is', null)
    .in('employe_id', Array.from(parId.keys()))
  const lignesCert = ((certs ?? []) as CertRow[]).filter(c => c.valide !== false && c.date_expiration)
  if (lignesCert.length === 0) return []

  const { data: formations } = await sb.from('formations').select('id, titre, clinique')
    .in('id', Array.from(new Set(lignesCert.map(c => c.formation_id))))
    .in('clinique', cliniquesContenuVisibles(acteur))
  const formParId = new Map((formations ?? []).map((f: { id: string; titre: string; clinique: CliniqueContenu }) => [f.id, f]))

  const lignes: LigneExpiration[] = []
  for (const c of lignesCert) {
    const f = formParId.get(c.formation_id)
    const e = parId.get(c.employe_id) as Record<string, unknown> | undefined
    if (!f || !e) continue
    const jours = joursRestants(c.date_expiration!)
    const dep = (e.departements as { nom?: string } | null)?.nom ?? (e.departement as string | null) ?? null
    lignes.push({
      certificat_id: c.id,
      numero_certificat: c.numero_certificat,
      employe_id: c.employe_id,
      employe_nom: `${e.prenom ?? ''} ${e.nom ?? ''}`.trim(),
      employe_email: (e.email as string | null) ?? null,
      clinique: (e.clinique as string | null) ?? null,
      departement: dep,
      formation_id: f.id,
      formation_titre: f.titre,
      formation_clinique: f.clinique ?? null,
      date_emission: c.date_emission,
      date_expiration: c.date_expiration!,
      jours_restants: jours,
      statut: statutExpiration(jours, horizon),
    })
  }
  return lignes.sort((a, b) => a.jours_restants - b.jours_restants)
}
