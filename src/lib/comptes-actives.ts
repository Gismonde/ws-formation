// Comptes activés : l'employé a choisi son mot de passe (il s'est connecté au moins une fois).
// Les courriels « formation assignée » ne sont pas envoyés à un compte pas encore activé :
// ils partent automatiquement à l'activation (voir /api/auth/activation).
import type { SupabaseClient } from '@supabase/supabase-js'

/** auth_user_id des comptes déjà activés, parmi ceux donnés. */
export async function comptesActives(sb: SupabaseClient, authIds: (string | null | undefined)[]): Promise<Set<string>> {
  const ids = Array.from(new Set(authIds.filter(Boolean) as string[]))
  const actifs = new Set<string>()
  for (let i = 0; i < ids.length; i += 10) {
    await Promise.all(ids.slice(i, i + 10).map(async id => {
      try {
        const { data } = await sb.auth.admin.getUserById(id)
        // En cas de doute (lecture impossible), on considère le compte activé : le courriel part comme avant
        if (!data?.user || data.user.last_sign_in_at) actifs.add(id)
      } catch { actifs.add(id) }
    }))
  }
  return actifs
}
