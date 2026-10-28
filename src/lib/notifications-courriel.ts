// Envoi des notifications personnalisées : lit les modèles (Admin → Paramètres → Notifications)
// et compose le courriel. Notification désactivée → aucun courriel.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Courriel } from '@/lib/courriels'
import { REGLAGES_DEFAUT, remplir, rendreCourriel, typeDe, type ModeleNotification, type ReglagesNotifications } from '@/lib/notifications-catalogue'

export type LigneModele = { cle: string; actif: boolean; sujet: string | null; message: string | null; bouton: string | null }
export type ConfigNotifications = { modeles: Map<string, LigneModele>; reglages: ReglagesNotifications }

/** Modèles enregistrés + coordonnées (tables absentes → textes par défaut). */
export async function chargerNotifications(sb: SupabaseClient): Promise<ConfigNotifications> {
  const [m, r] = await Promise.all([
    sb.from('notifications_modeles').select('cle, actif, sujet, message, bouton'),
    sb.from('notifications_reglages').select('contact_libelle, contact_courriel, contact_telephone').eq('id', 1).maybeSingle(),
  ])
  const modeles = new Map(((m.data ?? []) as LigneModele[]).map(l => [l.cle, l]))
  const d = (r.data ?? {}) as Partial<ReglagesNotifications>
  return {
    modeles,
    reglages: {
      contact_libelle: d.contact_libelle || REGLAGES_DEFAUT.contact_libelle,
      contact_courriel: d.contact_courriel || '',
      contact_telephone: d.contact_telephone || '',
    },
  }
}

/** Modèle en vigueur pour ce type (texte enregistré, sinon texte par défaut). */
export function modeleEnVigueur(cfg: ConfigNotifications | null, cle: string): (ModeleNotification & { actif: boolean }) | null {
  const type = typeDe(cle)
  if (!type) return null
  const l = cfg?.modeles.get(cle)
  return {
    actif: l?.actif !== false,
    sujet: l?.sujet?.trim() || type.defaut.sujet,
    message: l?.message?.trim() || type.defaut.message,
    bouton: l?.bouton?.trim() || type.defaut.bouton,
  }
}

/** Compose le courriel d'une notification ; null si elle est désactivée ou sans adresse. */
export function composerNotification(cfg: ConfigNotifications | null, cle: string, p: {
  a: string | null | undefined
  origine: string
  clinique: string | null
  prenom?: string | null
  nom?: string | null
  vars?: Record<string, string | null | undefined>
  lien?: string | null
}): Courriel | null {
  const mod = modeleEnVigueur(cfg, cle)
  if (!mod || !mod.actif || !p.a) return null
  const nomComplet = [p.prenom, p.nom].filter(Boolean).join(' ').trim()
  const vars = { prenom: p.prenom ?? '', nom: p.nom ?? '', nom_complet: nomComplet, courriel: p.a, ...(p.vars ?? {}) }
  const { html, texte } = rendreCourriel({
    origine: p.origine, clinique: p.clinique, destinataire: nomComplet || null, titre: remplir(mod.sujet, vars),
    message: mod.message, vars, bouton: p.lien ? { libelle: mod.bouton, lien: p.lien } : null, reglages: cfg?.reglages,
  })
  return { a: p.a, sujet: remplir(mod.sujet, vars), html, texte }
}
