'use server'
// Modèles de leçons enregistrés par l'équipe : une leçon réussie devient un point de départ réutilisable.
import { getCreateurFormations, serviceClient, cliniquesContenuVisibles, peutGererContenu, peutVoirContenu } from '@/lib/permissions'
import { blocsVersModele, type ModeleLecon, type BlocModele } from '@/lib/modeles-lecon'
import type { ActionResult } from './formations'

type Ligne = { id: string; nom: string; description: string | null; icone: string; clinique: string; attestation: boolean; blocs: BlocModele[]; cree_par: string | null }

/** Modèles enregistrés visibles pour la clinique d'une formation (ceux de la clinique + communs) */
export async function listerModelesPerso(formationId: string): Promise<ActionResult<ModeleLecon[]>> {
  const acteur = await getCreateurFormations()
  if (!acteur) return { success: false, error: 'Non autorisé' }
  const sb = serviceClient()
  const { data: f } = await sb.from('formations').select('clinique').eq('id', formationId).maybeSingle()
  const visibles = cliniquesContenuVisibles(acteur)
  const cliniques = f?.clinique && f.clinique !== 'LES_DEUX' ? [f.clinique, 'LES_DEUX'] : visibles
  const { data, error } = await sb.from('modeles_lecons').select('*').in('clinique', cliniques.filter(c => visibles.includes(c as never))).order('nom')
  if (error) return { success: true, data: [] } // table pas encore créée : seulement les modèles intégrés
  return {
    success: true,
    data: ((data ?? []) as Ligne[]).map(m => ({
      id: m.id, nom: m.nom, icone: m.icone || '⭐', description: m.description ?? '', attestation: m.attestation, blocs: m.blocs ?? [],
      perso: { clinique: m.clinique, creePar: m.cree_par, parMoi: m.cree_par === acteur.id },
    })),
  }
}

/** Enregistre le contenu d'une leçon comme modèle */
export async function enregistrerModeleLecon(leconId: string, champs: { nom: string; description?: string; clinique: string }): Promise<ActionResult<{ id: string }>> {
  const acteur = await getCreateurFormations()
  if (!acteur) return { success: false, error: 'Non autorisé' }
  const nom = champs.nom.trim().slice(0, 120)
  if (!nom) return { success: false, error: 'Donnez un nom au modèle.' }
  if (!['CMC', 'WSSC', 'LES_DEUX'].includes(champs.clinique) || !peutGererContenu(acteur, champs.clinique)) return { success: false, error: 'Clinique non permise' }
  const sb = serviceClient()
  const { data: lecon } = await sb.from('lessons').select('id, attestation_requise, modules(formations(clinique))').eq('id', leconId).maybeSingle()
  if (!lecon) return { success: false, error: 'Leçon introuvable' }
  const m = lecon.modules as { formations?: { clinique?: string } | { clinique?: string }[] } | { formations?: { clinique?: string } }[] | null
  const mod = Array.isArray(m) ? m[0] : m
  const fo = Array.isArray(mod?.formations) ? mod?.formations[0] : mod?.formations
  if (!peutVoirContenu(acteur, fo?.clinique ?? 'LES_DEUX')) return { success: false, error: 'Leçon hors de votre périmètre' }
  const { data: blocs } = await sb.from('content_blocks').select('type, titre, contenu, url, metadata').eq('lesson_id', leconId).order('ordre')
  if (!blocs?.length) return { success: false, error: 'La leçon est vide.' }
  const { data, error } = await sb.from('modeles_lecons').insert({
    nom, description: (champs.description ?? '').trim().slice(0, 300) || null, clinique: champs.clinique,
    attestation: !!lecon.attestation_requise, blocs: blocsVersModele(blocs), cree_par: acteur.id,
  }).select('id').single()
  if (error) return { success: false, error: error.message.includes('modeles_lecons') ? 'Exécutez d’abord supabase/migrations/modeles_lecons.sql dans Supabase.' : error.message }
  return { success: true, data: { id: data.id as string } }
}

/** Supprime un modèle enregistré (son auteur, ou un administrateur de la clinique) */
export async function supprimerModeleLecon(id: string): Promise<ActionResult> {
  const acteur = await getCreateurFormations()
  if (!acteur) return { success: false, error: 'Non autorisé' }
  const sb = serviceClient()
  const { data: m } = await sb.from('modeles_lecons').select('cree_par, clinique').eq('id', id).maybeSingle()
  if (!m) return { success: false, error: 'Modèle introuvable' }
  const autorise = m.cree_par === acteur.id || (acteur.role !== 'gestionnaire' && peutGererContenu(acteur, m.clinique))
  if (!autorise) return { success: false, error: 'Seul l’auteur du modèle ou un administrateur peut le supprimer.' }
  const { error } = await sb.from('modeles_lecons').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true, data: undefined }
}
