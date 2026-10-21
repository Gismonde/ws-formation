// Suppression définitive d'employés archivés : réservée aux administrateurs globaux,
// avec une raison obligatoire et une trace dans suppressions_employes. Côté serveur.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Acteur } from '@/lib/permissions'

export const RAISON_MIN = 10

export type Suppression = {
  id: string; employe_id: string; prenom: string | null; nom: string | null; email: string | null
  role: string | null; clinique: string | null; raison: string; resume: Record<string, number> | null
  supprime_par_nom: string | null; supprime_le: string
}

export function peutSupprimerEmployes(a: Acteur | null): boolean {
  return a?.role === 'super_admin'
}

/** Raison valide (texte libre, au moins RAISON_MIN caractères), sinon null. */
export function lireRaison(v: unknown): string | null {
  const r = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, 1000) : ''
  return r.length >= RAISON_MIN ? r : null
}

const TABLES_COMPTEES = [
  'assignations', 'progressions', 'lesson_progressions', 'tentatives_questionnaire', 'certificats',
  'preuves_externes', 'preuves_lecture', 'politiques_confirmations', 'sondage_reponses',
] as const

type Employe = { id: string; auth_user_id: string | null; prenom: string | null; nom: string | null; email: string | null; role: string | null; clinique: string | null; actif: boolean | null }

/** Supprime un employé archivé et ses données de formation. Retourne la ligne de traçabilité, ou une erreur. */
export async function supprimerEmploye(sb: SupabaseClient, a: Acteur, e: Employe, raison: string): Promise<{ ok: true } | { erreur: string }> {
  if (e.actif !== false) return { erreur: 'L’employé doit d’abord être archivé' }
  if (e.id === a.id) return { erreur: 'Vous ne pouvez pas vous supprimer vous-même' }

  // Résumé de ce qui est effacé (pour la traçabilité)
  const resume: Record<string, number> = {}
  for (const t of TABLES_COMPTEES) {
    const { count } = await sb.from(t).select('*', { count: 'exact', head: true }).eq('employe_id', e.id)
    if (count) resume[t] = count
  }

  // Fichiers de preuves externes dans le stockage
  const { data: preuves } = await sb.from('preuves_externes').select('fichier_url').eq('employe_id', e.id)
  const fichiers = (preuves ?? []).map(p => p.fichier_url as string | null).filter((f): f is string => !!f && !/^https?:\/\//.test(f))

  // Trace d'abord : si elle échoue, rien n'est supprimé
  const { error: errTrace } = await sb.from('suppressions_employes').insert({
    employe_id: e.id, prenom: e.prenom, nom: e.nom, email: e.email, role: e.role, clinique: e.clinique,
    raison, resume, supprime_par: a.id, supprime_par_nom: [a.prenom, a.nom].filter(Boolean).join(' ') || null,
  })
  if (errTrace) return { erreur: /suppressions_employes/.test(errTrace.message) ? 'Exécutez d’abord supabase/migrations/suppressions_employes.sql dans Supabase.' : errTrace.message }

  // Références sans suppression en cascade : on les détache
  await sb.from('formations').update({ creee_par: null }).eq('creee_par', e.id)
  await sb.from('assignations').update({ assigne_par: null }).eq('assigne_par', e.id)
  await sb.from('preuves_externes').update({ valide_par: null }).eq('valide_par', e.id)

  const { error } = await sb.from('employes').delete().eq('id', e.id)
  if (error) {
    await sb.from('suppressions_employes').delete().eq('employe_id', e.id).eq('raison', raison)
    return { erreur: error.message }
  }
  if (fichiers.length) await sb.storage.from('preuves').remove(fichiers).catch(() => null)
  if (e.auth_user_id) await sb.auth.admin.deleteUser(e.auth_user_id).catch(() => null)
  return { ok: true }
}
