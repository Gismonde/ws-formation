// Accès aux formations hors assignation (« Formations disponibles ») : libre ou sur demande. Côté serveur.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Acteur } from '@/lib/permissions'
import { peutGererContenu } from '@/lib/permissions'

export type ModeAcces = 'aucun' | 'libre' | 'demande'
export type StatutDemande = 'en_attente' | 'acceptee' | 'refusee'

export type FormationDisponible = {
  id: string; titre: string; description: string | null; categorie: string | null; niveau: string | null
  duree_estimee_minutes: number | null; image_couverture: string | null
  mode: 'libre' | 'demande'; inscrit: boolean; demande: StatutDemande | null; motif: string | null
}

export type DemandeAcces = {
  id: string; employe_id: string; statut: StatutDemande; message: string | null; demandee_le: string
  traitee_le: string | null; motif: string | null; nom: string; poste: string | null; traitee_par_nom: string | null
}

/** Formations publiées ouvertes hors assignation dans l'espace ; [] tant que la migration n'est pas exécutée. */
export async function formationsDisponibles(sb: SupabaseClient, employeId: string, cliniques: string[]): Promise<FormationDisponible[]> {
  const { data, error } = await sb.from('formations')
    .select('id, titre, description, categorie, niveau, duree_estimee_minutes, image_couverture, acces_hors_assignation')
    .eq('publiee', true).in('acces_hors_assignation', ['libre', 'demande']).in('clinique', cliniques)
    .order('titre')
  if (error || !data?.length) return []
  const ids = data.map(f => f.id as string)
  const [{ data: ass }, { data: dem }] = await Promise.all([
    sb.from('assignations').select('formation_id').eq('employe_id', employeId).in('formation_id', ids),
    sb.from('demandes_acces_formation').select('formation_id, statut, motif').eq('employe_id', employeId).in('formation_id', ids),
  ])
  const inscrits = new Set((ass ?? []).map(a => a.formation_id as string))
  const demandes = new Map((dem ?? []).map(d => [d.formation_id as string, d]))
  return data.map(f => {
    const d = demandes.get(f.id as string)
    return {
      id: f.id, titre: f.titre, description: f.description, categorie: f.categorie, niveau: f.niveau,
      duree_estimee_minutes: f.duree_estimee_minutes, image_couverture: f.image_couverture,
      mode: f.acces_hors_assignation as 'libre' | 'demande', inscrit: inscrits.has(f.id as string),
      demande: (d?.statut as StatutDemande) ?? null, motif: (d?.motif as string) ?? null,
    }
  })
}

/** Peut traiter les demandes d'accès : admin qui gère la clinique de la formation, ou responsable de la formation. */
export function peutTraiterDemandes(a: Acteur | null, f: { clinique: string | null; responsable_id?: string | null }): boolean {
  if (!a) return false
  if (f.responsable_id && f.responsable_id === a.id) return true
  return (a.role === 'super_admin' || a.role === 'admin') && peutGererContenu(a, f.clinique)
}

/** Demandes d'accès d'une formation, les plus récentes d'abord. */
export async function demandesDeFormation(sb: SupabaseClient, formationId: string): Promise<DemandeAcces[]> {
  const { data, error } = await sb.from('demandes_acces_formation')
    .select('id, employe_id, statut, message, demandee_le, traitee_le, motif, traitee_par')
    .eq('formation_id', formationId).order('demandee_le', { ascending: false })
  if (error || !data?.length) return []
  const ids = Array.from(new Set(data.flatMap(d => [d.employe_id, d.traitee_par]).filter(Boolean) as string[]))
  const { data: emps } = await sb.from('employes').select('id, prenom, nom, poste').in('id', ids)
  const par = new Map((emps ?? []).map(e => [e.id as string, e]))
  const nom = (i: string | null) => { const e = i ? par.get(i) : null; return e ? `${e.prenom ?? ''} ${e.nom ?? ''}`.trim() : '' }
  return data.map(d => ({
    id: d.id, employe_id: d.employe_id, statut: d.statut as StatutDemande, message: d.message, demandee_le: d.demandee_le,
    traitee_le: d.traitee_le, motif: d.motif, nom: nom(d.employe_id) || '—', poste: (par.get(d.employe_id)?.poste as string) ?? null,
    traitee_par_nom: nom(d.traitee_par) || null,
  }))
}

/** Crée l'assignation volontaire (hors obligation), si elle n'existe pas déjà. */
export async function inscrireVolontaire(sb: SupabaseClient, employeId: string, formationId: string, par: string): Promise<string | null> {
  const { data: deja } = await sb.from('assignations').select('formation_id').eq('employe_id', employeId).eq('formation_id', formationId).maybeSingle()
  if (deja) return null
  const ligne = { employe_id: employeId, formation_id: formationId, assigne_par: par, date_assignation: new Date().toISOString(), volontaire: true }
  let { error } = await sb.from('assignations').insert(ligne)
  if (error && /volontaire/.test(error.message)) {
    const { volontaire: _v, ...sans } = ligne; void _v
    ;({ error } = await sb.from('assignations').insert(sans))
  }
  return error ? error.message : null
}
