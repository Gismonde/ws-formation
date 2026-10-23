// Notifications du portail employé (cloche 🔔), calculées en direct à partir de son dossier :
// nouvelles formations assignées, échéances proches ou dépassées, politiques à lire, événements,
// journées de formation, certificats à renouveler, réponses aux suggestions.
// « Lu / non lu » : date de dernière ouverture de la cloche, gardée sur l'appareil.
import type { SupabaseClient } from '@supabase/supabase-js'
import { chargerEtatsFormations, estComplete } from '@/lib/etat-formations'
import { politiquesDeLEmploye } from '@/lib/politiques'
import { evenementsDeLEmploye } from '@/lib/evenements'
import { empreinteAuteur } from '@/lib/suggestions'
import type { Clinique } from '@/lib/cliniques'

export type Notification = {
  id: string
  icone: string
  titre: string
  vars?: Record<string, string | number>
  lien: string
  /** Date de l'événement (tri et « non lu ») */
  le: string
  urgent?: boolean
}

const JOUR = 86_400_000
/** Jours du calendrier entre aujourd'hui et une date (0 = aujourd'hui, négatif = dépassée) */
export const jours = (a: string, b = Date.now()) => {
  const aujourdhui = new Date(b); aujourdhui.setHours(0, 0, 0, 0)
  return Math.round((Date.parse(a.slice(0, 10) + 'T00:00:00') - aujourdhui.getTime()) / JOUR)
}

type EmployeNotif = { id: string; clinique: string | null; role?: string | null; departement_id: string | null; poste?: string | null }

/** Notifications d'échéance pour une assignation non terminée (fonction pure, testée) */
export function notifEcheance(f: { id: string; titre: string }, echeance: string | null, maintenant = Date.now()): Notification | null {
  if (!echeance) return null
  const restant = jours(echeance, maintenant)
  if (restant < 0) return { id: `retard:${f.id}`, icone: '⏰', titre: 'En retard : {titre}', vars: { titre: f.titre }, lien: `/formations/${f.id}`, le: echeance + 'T00:00:00', urgent: true }
  if (restant <= 3) return { id: `echeance:${f.id}:${echeance}`, icone: '⏳', titre: restant === 0 ? 'Échéance aujourd’hui : {titre}' : 'Échéance dans {n} jour(s) : {titre}', vars: { titre: f.titre, n: restant }, lien: `/formations/${f.id}`, le: new Date(Date.parse(echeance + 'T00:00:00') - 3 * JOUR).toISOString(), urgent: true }
  return null
}

export async function notificationsEmploye(sb: SupabaseClient, e: EmployeNotif, espace: Clinique | null): Promise<Notification[]> {
  const n: Notification[] = []
  const recent = (d: string | null | undefined, nbJours: number) => !!d && Date.now() - Date.parse(d) <= nbJours * JOUR

  // Formations assignées
  const { data: assign } = await sb.from('assignations').select('formation_id, date_assignation, date_echeance, formations(id, titre, publiee)').eq('employe_id', e.id)
  const lignes = (assign ?? []).map(a => ({ ...a, f: (Array.isArray(a.formations) ? a.formations[0] : a.formations) as { id: string; titre: string; publiee: boolean } | null }))
    .filter(a => a.f?.publiee)
  const etat = await chargerEtatsFormations(sb, [e.id], lignes.map(a => a.formation_id as string))
  for (const a of lignes) {
    const s = etat(e.id, a.formation_id as string)
    if (estComplete(s.statut)) continue
    const ech = notifEcheance(a.f!, (a.date_echeance as string | null) ?? null)
    if (ech) n.push(ech)
    else if (recent(a.date_assignation as string | null, 14) && s.statut === 'non_commence') {
      n.push({ id: `assignee:${a.formation_id}`, icone: '🎓', titre: 'Nouvelle formation assignée : {titre}', vars: { titre: a.f!.titre }, lien: `/formations/${a.formation_id}`, le: a.date_assignation as string })
    }
  }
  // Certificats à renouveler (expiration dans 30 jours ou depuis moins de 30 jours)
  for (const a of lignes) {
    const c = etat(e.id, a.formation_id as string).certificat
    if (c?.date_expiration) {
      const r = jours(c.date_expiration)
      if (r <= 30 && r >= -30) n.push({ id: `certificat:${a.formation_id}:${c.date_expiration}`, icone: '🏆', titre: r < 0 ? 'Certificat expiré : {titre}' : 'Certificat à renouveler : {titre}', vars: { titre: a.f!.titre }, lien: `/formations/${a.formation_id}`, le: new Date(Date.parse(c.date_expiration) - 30 * JOUR).toISOString(), urgent: r < 0 })
    }
  }

  // Politiques à lire et confirmer
  try {
    for (const p of await politiquesDeLEmploye(sb, e, espace)) {
      if (!p.confirme_le) n.push({ id: `politique:${p.id}:${p.version}`, icone: '📜', titre: p.a_reconfirmer ? 'Nouvelle version à confirmer : {titre}' : 'Politique à lire et confirmer : {titre}', vars: { titre: p.titre }, lien: `/dashboard/politiques/${p.id}`, le: p.publiee_le })
    }
  } catch { /* table absente */ }

  // Événements ouverts aux inscriptions
  try {
    for (const x of await evenementsDeLEmploye(sb, e)) {
      const le = x.ev.publie_le ?? (x.ev as { created_at?: string }).created_at ?? null
      if (!x.mienne && !x.termine && le && recent(le, 30)) n.push({ id: `evenement:${x.ev.id}`, icone: '📅', titre: 'Nouvel événement : {titre}', vars: { titre: x.ev.titre }, lien: `/dashboard/evenements`, le })
    }
  } catch { /* table absente */ }

  // Journées de formation lancées récemment
  const { data: journees } = await sb.from('journees_formation').select('id, nom, cree_le').eq('modele', false).contains('employe_ids', [e.id])
  for (const j of journees ?? []) {
    if (recent(j.cree_le as string, 30)) n.push({ id: `journee:${j.id}`, icone: '🗓️', titre: 'Journée de formation : {titre}', vars: { titre: j.nom as string }, lien: `/dashboard/journees/${j.id}`, le: j.cree_le as string })
  }

  // Réponses aux suggestions
  const { data: sugg, error } = await sb.from('suggestions').select('id, sujet, statut, repondu_le').eq('empreinte', empreinteAuteur(e.id)).not('repondu_le', 'is', null)
  if (!error) for (const s of sugg ?? []) {
    if (recent(s.repondu_le as string, 30)) n.push({ id: `suggestion:${s.id}:${s.repondu_le}`, icone: '💡', titre: 'Réponse à votre suggestion', lien: '/dashboard/suggestions', le: s.repondu_le as string })
  }

  return n.sort((a, b) => Number(!!b.urgent) - Number(!!a.urgent) || b.le.localeCompare(a.le)).slice(0, 40)
}
