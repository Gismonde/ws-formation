// Comptes activés : l'employé a choisi son mot de passe depuis son lien (ou s'est déjà connecté).
// Aucun courriel (formations, événements, politiques, rappels…) n'est envoyé à un compte pas encore activé,
// au WSSC comme au CMC : seuls l'invitation et la réinitialisation du mot de passe partent avant
// (voir envoyerCourriels). Les courriels « formation assignée » retenus partent à l'activation.
import type { SupabaseClient } from '@supabase/supabase-js'

/** auth_user_id des comptes déjà activés, parmi ceux donnés. */
export async function comptesActives(sb: SupabaseClient, authIds: (string | null | undefined)[]): Promise<Set<string>> {
  const ids = Array.from(new Set(authIds.filter(Boolean) as string[]))
  const actifs = new Set<string>()
  // Mot de passe choisi depuis un lien d'invitation
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await sb.from('invitations_employes').select('auth_user_id').in('auth_user_id', ids.slice(i, i + 100)).not('utilise_le', 'is', null)
    for (const r of data ?? []) actifs.add(r.auth_user_id as string)
  }
  const reste = ids.filter(id => !actifs.has(id))
  for (let i = 0; i < reste.length; i += 10) {
    await Promise.all(reste.slice(i, i + 10).map(async id => {
      try {
        const { data } = await sb.auth.admin.getUserById(id)
        // En cas de doute (lecture impossible), on considère le compte activé : le courriel part comme avant
        if (!data?.user || data.user.last_sign_in_at) actifs.add(id)
      } catch { actifs.add(id) }
    }))
  }
  return actifs
}

/**
 * Courriels d'employés dont le compte n'est pas encore activé, parmi les adresses données (en minuscules).
 * Une adresse qui n'appartient à aucun employé (ex. participant externe) n'est jamais retenue.
 */
export async function adressesNonActivees(sb: SupabaseClient, adresses: string[]): Promise<Set<string>> {
  const liste = Array.from(new Set(adresses.map(a => a.trim().toLowerCase()).filter(Boolean)))
  const parAuth = new Map<string, string[]>()
  if (!liste.length) return new Set()
  // Comparaison insensible à la casse : toutes les fiches (quelques centaines) sont lues une fois
  const voulues = new Set(liste)
  for (let debut = 0; debut < 20_000; debut += 1000) {
    const { data, error } = await sb.from('employes').select('email, auth_user_id').not('email', 'is', null).range(debut, debut + 999)
    if (error) throw new Error(error.message)
    for (const e of data ?? []) {
      const email = String(e.email).trim().toLowerCase()
      if (!e.auth_user_id || !voulues.has(email)) continue
      parAuth.set(e.auth_user_id, [...(parAuth.get(e.auth_user_id) ?? []), email])
    }
    if (!data || data.length < 1000) break
  }
  const actifs = await comptesActives(sb, Array.from(parAuth.keys()))
  const non = new Set<string>()
  for (const [auth, emails] of parAuth) if (!actifs.has(auth)) emails.forEach(x => non.add(x))
  return non
}
