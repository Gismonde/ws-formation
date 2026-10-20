// Données de conformité (page Admin → Conformité, exports Excel / CSV / PDF).
// Côté serveur uniquement : clé de service + filtres de portée de l'acteur.
import type { SupabaseClient } from '@supabase/supabase-js'
import { type Acteur, filtrerEmployes, cliniquesContenuVisibles } from '@/lib/permissions'
import { cliniqueAffichee, type CliniqueContenu } from '@/lib/cliniques'
import { chargerEtatsFormations, estComplete, type StatutFormation, type CertificatEtat } from '@/lib/etat-formations'
import type { SuiviFormationEmploye } from '@/lib/suivi-formations'
import { joursRestants } from '@/lib/expirations'

export type AssignationConformite = {
  formation_id: string
  formation_titre: string
  formation_clinique: CliniqueContenu | null
  obligatoire: boolean
  date_assignation: string | null
  date_echeance: string | null
  en_retard: boolean
  statut: StatutFormation
  progression: number
  certificat: CertificatEtat | null
  certificat_valide: boolean
  suivi: SuiviFormationEmploye | null
}

export type EmployeConformite = {
  id: string
  nom: string
  prenom: string
  email: string
  poste: string
  departement: string
  departement_id: string | null
  clinique: string | null
  assignations: AssignationConformite[]
}

export type FiltresConformite = { clinique?: string | null; departement_id?: string | null; employe_ids?: string[] | null }

export type SyntheseConformite = {
  employes: number
  assignations: number
  completes: number
  en_cours: number
  en_retard: number
  certificats: number
  attestations_requises: number
  attestations_signees: number
  taux: number
}

export async function chargerConformite(sb: SupabaseClient, acteur: Acteur, filtres: FiltresConformite = {}): Promise<EmployeConformite[]> {
  let q = filtrerEmployes(
    sb.from('employes').select('id, nom, prenom, email, poste, departement, departement_id, clinique, role, actif, departements(nom)').order('nom'),
    acteur,
  )
  if (filtres.departement_id) q = q.eq('departement_id', filtres.departement_id)
  if (filtres.clinique === 'CMC' || filtres.clinique === 'WSSC') q = q.in('clinique', [filtres.clinique, 'LES_DEUX'])
  if (filtres.employe_ids?.length) q = q.in('id', filtres.employe_ids)
  const { data: employes } = await q
  const actifs = (employes ?? []).filter((e: { actif: boolean | null }) => e.actif !== false) as Record<string, unknown>[]
  if (actifs.length === 0) return []
  const ids = actifs.map(e => e.id as string)

  const { data: assignations } = await sb.from('assignations')
    .select('employe_id, formation_id, date_assignation, date_echeance').in('employe_id', ids)
  const formationIds = Array.from(new Set((assignations ?? []).map(a => a.formation_id as string)))
  const { data: formations } = formationIds.length
    ? await sb.from('formations').select('id, titre, clinique, obligatoire')
      .in('id', formationIds).in('clinique', cliniquesContenuVisibles(acteur))
    : { data: [] }
  const formParId = new Map((formations ?? []).map(f => [f.id as string, f]))
  const etat = await chargerEtatsFormations(sb, ids, Array.from(formParId.keys()))

  return actifs.map(e => {
    const lignes: AssignationConformite[] = (assignations ?? [])
      .filter(a => a.employe_id === e.id && formParId.has(a.formation_id))
      .map(a => {
        const f = formParId.get(a.formation_id)!
        const st = etat(e.id as string, f.id as string)
        const echeance = (a.date_echeance as string | null) ?? null
        return {
          formation_id: f.id as string,
          formation_titre: f.titre as string,
          formation_clinique: (f.clinique as CliniqueContenu) ?? null,
          obligatoire: f.obligatoire === true,
          date_assignation: (a.date_assignation as string | null) ?? null,
          date_echeance: echeance,
          en_retard: !!echeance && !estComplete(st.statut) && joursRestants(echeance) < 0,
          ...st,
        }
      })
      .sort((x, y) => x.formation_titre.localeCompare(y.formation_titre, 'fr'))
    return {
      id: e.id as string,
      nom: (e.nom as string) ?? '',
      prenom: (e.prenom as string) ?? '',
      email: (e.email as string) ?? '',
      poste: (e.poste as string) ?? '',
      departement: (e.departements as { nom?: string } | null)?.nom ?? (e.departement as string) ?? '',
      departement_id: (e.departement_id as string | null) ?? null,
      clinique: cliniqueAffichee(e.clinique as string | null, e.role as string | null),
      assignations: lignes,
    }
  })
}

export function synthese(donnees: EmployeConformite[]): SyntheseConformite {
  const toutes = donnees.flatMap(e => e.assignations)
  const completes = toutes.filter(a => estComplete(a.statut)).length
  return {
    employes: donnees.length,
    assignations: toutes.length,
    completes,
    en_cours: toutes.filter(a => a.statut === 'en_cours').length,
    en_retard: toutes.filter(a => a.en_retard).length,
    certificats: toutes.filter(a => a.certificat_valide).length,
    attestations_requises: toutes.reduce((s, a) => s + (a.suivi?.attestations_requises ?? 0), 0),
    attestations_signees: toutes.reduce((s, a) => s + (a.suivi?.attestations_signees ?? 0), 0),
    taux: toutes.length ? Math.round((completes / toutes.length) * 100) : 0,
  }
}

export type LigneRapportFormation = {
  formation_id: string
  titre: string
  categorie: string | null
  clinique: CliniqueContenu | null
  obligatoire: boolean
  assignes: number
  completes: number
  en_cours: number
  non_commences: number
  en_retard: number
  certificats: number
  taux: number
}

/** Statistiques par formation (page Rapports) à partir des données de conformité. */
export function rapportParFormation(
  donnees: EmployeConformite[],
  formations: { id: string; titre: string; categorie: string | null; clinique: CliniqueContenu | null; obligatoire: boolean | null }[],
): LigneRapportFormation[] {
  const toutes = donnees.flatMap(e => e.assignations)
  return formations.map(f => {
    const a = toutes.filter(x => x.formation_id === f.id)
    const completes = a.filter(x => estComplete(x.statut)).length
    return {
      formation_id: f.id, titre: f.titre, categorie: f.categorie, clinique: f.clinique, obligatoire: f.obligatoire === true,
      assignes: a.length,
      completes,
      en_cours: a.filter(x => x.statut === 'en_cours').length,
      non_commences: a.filter(x => x.statut === 'non_commence').length,
      en_retard: a.filter(x => x.en_retard).length,
      certificats: a.filter(x => x.certificat_valide).length,
      taux: a.length ? Math.round((completes / a.length) * 100) : 0,
    }
  }).sort((x, y) => y.assignes - x.assignes || x.titre.localeCompare(y.titre, 'fr'))
}

/** Formations publiées visibles par l'acteur (page Rapports). */
export async function formationsDuRapport(sb: SupabaseClient, acteur: Acteur) {
  const { data } = await sb.from('formations').select('id, titre, categorie, clinique, obligatoire')
    .eq('publiee', true).in('clinique', cliniquesContenuVisibles(acteur)).order('titre')
  return (data ?? []) as { id: string; titre: string; categorie: string | null; clinique: CliniqueContenu | null; obligatoire: boolean | null }[]
}
