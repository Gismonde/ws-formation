// État de l'accès de chaque employé au portail (page Employés → Accès des employés) :
//  - « active »  : l'employé a choisi son mot de passe et s'est déjà connecté ;
//  - « invite »  : un courriel d'activation est parti, mais l'employé ne s'est jamais connecté ;
//  - « jamais »  : aucun courriel d'activation n'est encore parti (ex. import avec invitations remises à plus tard).
// La connexion vient du compte de connexion (last_sign_in_at) ; les envois viennent du journal d'audit.
import type { SupabaseClient } from '@supabase/supabase-js'

export type EtatAcces = 'active' | 'invite' | 'jamais'

export type LogInvitation = { cible_employe_id: string | null; type_action: string; description: string | null; metadata: Record<string, unknown> | null; created_at: string }

/** Le journal indique-t-il qu'un courriel d'activation (ou un nouveau lien) est parti ? */
export function courrielParti(l: LogInvitation): boolean {
  const m = l.metadata ?? {}
  if (l.type_action === 'EMPLOYE_CREE') return m.invitation_envoyee === true
  if (l.type_action !== 'INVITATION_ENVOYEE') return false
  if (typeof m.courriel === 'boolean') return m.courriel
  if (typeof m.envoye === 'boolean') return m.envoye
  return /envoy[ée] par courriel|lien de réinitialisation envoy[ée]/i.test(l.description ?? '')
}

/** « Compte activé : mot de passe choisi depuis le lien d'invitation » */
export const estActivation = (l: LogInvitation) => l.type_action === 'INVITATION_ENVOYEE' && /^Compte activ[ée]/i.test(l.description ?? '')

export type Acces = { etat: EtatAcces; date: string | null; derniereConnexion: string | null }

/**
 * - activé : date d'activation (premier lien utilisé ou journal), sinon date de la dernière connexion ;
 * - invité : date du dernier courriel envoyé.
 */
export function etatAcces(p: { derniereConnexion: string | null; logs: LogInvitation[]; lienUtiliseLe?: string | null }): Acces {
  const tri = (a: string, b: string) => a.localeCompare(b)
  if (p.derniereConnexion) {
    const activations = p.logs.filter(estActivation).map(l => l.created_at)
    const premiere = [p.lienUtiliseLe, ...activations].filter((d): d is string => !!d).sort(tri)[0]
    return { etat: 'active', date: premiere ?? p.derniereConnexion, derniereConnexion: p.derniereConnexion }
  }
  const envois = p.logs.filter(courrielParti).map(l => l.created_at).sort(tri)
  return envois.length
    ? { etat: 'invite', date: envois[envois.length - 1], derniereConnexion: null }
    : { etat: 'jamais', date: null, derniereConnexion: null }
}

/** Dernière connexion de chaque compte de connexion (auth_user_id → date ou null). */
export async function dernieresConnexions(sb: SupabaseClient): Promise<Map<string, string | null>> {
  const m = new Map<string, string | null>()
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !data?.users?.length) break
    for (const u of data.users) m.set(u.id, u.last_sign_in_at ?? null)
    if (data.users.length < 1000) break
  }
  return m
}

/** Envois d'invitation et activations du journal, pour ces employés. */
export async function logsInvitations(sb: SupabaseClient, employeIds: string[]): Promise<LogInvitation[]> {
  const res: LogInvitation[] = []
  for (let i = 0; i < employeIds.length; i += 100) {
    const lot = employeIds.slice(i, i + 100)
    for (let debut = 0; ; debut += 1000) {
      const { data, error } = await sb.from('audit_logs').select('cible_employe_id, type_action, description, metadata, created_at')
        .in('type_action', ['EMPLOYE_CREE', 'INVITATION_ENVOYEE']).in('cible_employe_id', lot)
        .order('created_at').range(debut, debut + 999)
      if (error || !data?.length) break
      res.push(...(data as LogInvitation[]))
      if (data.length < 1000) break
    }
  }
  return res
}

/** Première utilisation d'un lien d'invitation, par compte de connexion. */
export async function liensUtilises(sb: SupabaseClient, authIds: string[]): Promise<Map<string, string>> {
  const m = new Map<string, string>()
  for (let i = 0; i < authIds.length; i += 100) {
    const { data } = await sb.from('invitations_employes').select('auth_user_id, utilise_le').in('auth_user_id', authIds.slice(i, i + 100)).not('utilise_le', 'is', null)
    for (const r of (data ?? []) as { auth_user_id: string; utilise_le: string }[]) {
      const d = m.get(r.auth_user_id)
      if (!d || r.utilise_le < d) m.set(r.auth_user_id, r.utilise_le)
    }
  }
  return m
}
