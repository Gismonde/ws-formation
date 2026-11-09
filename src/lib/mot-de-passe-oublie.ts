// « Mot de passe oublié ? » : l'employé demande lui-même un lien pour choisir un nouveau mot de passe.
//  - Réponse toujours identique, que le courriel existe ou non (on ne révèle pas qui a un compte).
//  - Au plus MAX_DEMANDES demandes par compte sur FENETRE_MINUTES (compté dans le journal d'audit).
//  - Les liens d'invitation encore ouverts sont annulés ; la demande est inscrite au journal d'audit.
import type { SupabaseClient } from '@supabase/supabase-js'
import { inviterEmploye } from '@/lib/invitations'
import { logAudit } from '@/lib/audit'

export const MAX_DEMANDES = 3
export const FENETRE_MINUTES = 15
export const MOTIF_AUDIT = 'mdp_oublie'

/** Courriel normalisé, ou null s'il n'a pas une forme valide. */
export function normaliserCourriel(v: unknown): string | null {
  const s = String(v ?? '').trim().toLowerCase()
  if (s.length < 5 || s.length > 254) return null
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null
}

/** Échappe les caractères spéciaux d'un motif ILIKE (recherche exacte, insensible à la casse). */
export const motifExact = (s: string) => s.replace(/[\\%_]/g, c => '\\' + c)

export const limiteAtteinte = (demandesRecentes: number) => demandesRecentes >= MAX_DEMANDES

export type Bilan = 'envoye' | 'inconnu' | 'inactif' | 'limite' | 'erreur'

/** Traite la demande. Le résultat sert au journal et aux tests : jamais renvoyé tel quel au navigateur. */
export async function demanderReinitialisation(sb: SupabaseClient, params: { email: unknown; origine: string; ip?: string | null; agent?: string | null }): Promise<Bilan> {
  const email = normaliserCourriel(params.email)
  if (!email) return 'inconnu'
  const { data: emps } = await sb.from('employes').select('id, prenom, nom, email, clinique, actif, auth_user_id').ilike('email', motifExact(email)).limit(2)
  const emp = (emps ?? []).length === 1 ? emps![0] : null
  if (!emp?.auth_user_id || !emp.email) return 'inconnu'
  if (emp.actif === false) return 'inactif'

  const depuis = new Date(Date.now() - FENETRE_MINUTES * 60_000).toISOString()
  const { count } = await sb.from('audit_logs').select('id', { count: 'exact', head: true })
    .eq('cible_employe_id', emp.id).contains('metadata', { motif: MOTIF_AUDIT }).gte('created_at', depuis)
  if (limiteAtteinte(count ?? 0)) return 'limite'

  // Les liens d'invitation encore ouverts cessent de fonctionner (un compte jamais activé en reçoit un nouveau)
  await sb.from('invitations_employes').update({ annule_le: new Date().toISOString() })
    .eq('auth_user_id', emp.auth_user_id).is('utilise_le', null).is('annule_le', null)

  const res = await inviterEmploye(sb, {
    email: emp.email, prenom: emp.prenom ?? '', nom: emp.nom ?? '', clinique: emp.clinique ?? null,
    origine: params.origine, nouveau: false, oubli: true,
  })
  await logAudit({
    acteur_id: emp.id, cible_employe_id: emp.id, type_action: 'INVITATION_ENVOYEE',
    description: res.courrielEnvoye ? 'Mot de passe oublié : lien de réinitialisation envoyé par courriel' : 'Mot de passe oublié : le courriel n’a pas pu être envoyé',
    metadata: { motif: MOTIF_AUDIT, envoye: res.courrielEnvoye },
    ip_address: params.ip ?? null, user_agent: params.agent ?? null,
  })
  return res.courrielEnvoye ? 'envoye' : 'erreur'
}
