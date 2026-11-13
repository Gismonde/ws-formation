// Ouverture d'une journée de formation : assignation des formations et des politiques + un courriel par employé.
//  - journée d'aujourd'hui ou sans date : ouverte dès le lancement ;
//  - journée datée dans le futur : enregistrée seulement ; la tâche du matin (cron quotidien, ~7 h) l'ouvre le jour prévu.
// Avant l'ouverture, l'employé ne voit rien (ni la journée, ni les formations, ni les éléments à visionner).
import type { SupabaseClient } from '@supabase/supabase-js'
import { acteurDepuisEmploye, type Acteur } from '@/lib/permissions'
import { employesDeLaCible, assignerFormations, assignerPolitiques } from '@/lib/assignations-groupees'
import { courrielsActifs, envoyerCourriels, gabarit } from '@/lib/courriels'
import { comptesActives } from '@/lib/comptes-actives'
import { contenuJournee, aujourdhui, type Journee } from '@/lib/journees'
export { aujourdhui, estProgrammee, journeeOuverte, etatJournee } from '@/lib/journees'
import { logAudit } from '@/lib/audit'

type EmployeOuverture = { id: string; prenom: string | null; email: string | null; clinique: string | null }

export type BilanOuverture = { employes: number; formations: unknown[]; politiques: unknown[]; courriels: number; migrationPolitiques?: boolean }

/** Assigne le contenu de la journée, inscrit l'ouverture au journal, prévient les employés. */
export async function ouvrirJournee(sb: SupabaseClient, acteur: Acteur, j: Journee, origine: string, options: { notifier: boolean; meta?: Record<string, unknown> }): Promise<BilanOuverture | { erreur: string; statut: number }> {
  const { employes, erreur } = await employesDeLaCible(sb, acteur, { type: 'employes', ids: j.employe_ids })
  if (erreur) return { erreur, statut: 403 }
  if (employes.length === 0) return { erreur: 'Aucun employé actif dans votre périmètre parmi ceux choisis.', statut: 400 }

  const formations = j.formation_ids.length ? await assignerFormations(sb, acteur, j.formation_ids, employes, j.date_echeance) : null
  const politiques = j.politique_ids.length ? await assignerPolitiques(sb, acteur, j.politique_ids, { type: 'employes', ids: employes.map(e => e.id) }, employes) : null
  if (politiques?.migrationRequise) return { erreur: 'Exécutez d’abord supabase/migrations/politiques_employes.sql dans Supabase.', statut: 503 }

  // Marque l'ouverture (sans effet si la colonne n'existe pas encore)
  await sb.from('journees_formation').update({ ouverte_le: new Date().toISOString() }).eq('id', j.id)

  await logAudit({
    acteur_id: acteur.id, type_action: 'FORMATION_ASSIGNEE',
    description: `Journée de formation « ${j.nom} » ouverte pour ${employes.length} employé(s) : ${j.formation_ids.length} formation(s), ${j.politique_ids.length} politique(s), ${j.librairie_ids.length} élément(s) à visionner`,
    metadata: { journee_id: j.id, raison: j.raison, employes: employes.map(e => e.id), date_journee: j.date_journee },
    ...(options.meta ?? {}),
  })

  const courriels = options.notifier && courrielsActifs() ? await prevenirEmployes(sb, j, employes, origine) : 0
  return { employes: employes.length, formations: formations?.resultats ?? [], politiques: politiques?.resultats ?? [], courriels }
}

/** Un seul courriel par employé, qui présente toute la journée. Comptes pas encore activés : courriel retenu. */
async function prevenirEmployes(sb: SupabaseClient, j: Journee, employes: EmployeOuverture[], origine: string): Promise<number> {
  const c = await contenuJournee(sb, j)
  const longue = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('fr-CA', { dateStyle: 'long' })
  const echeance = j.date_echeance ? longue(j.date_echeance) : null
  const lignes = [
    ...c.formations.map(f => `• Formation : ${f.titre}`),
    ...c.politiques.map(p => `• Politique à lire et confirmer : ${p.titre}`),
    ...c.librairie.map(l => `• À visionner : ${l.titre}`),
  ]
  const intro = !j.date_journee ? `Une journée de formation (${j.raison}) vous a été attribuée.`
    : j.date_journee === aujourdhui() ? `Votre journée de formation (${j.raison}) commence aujourd’hui.`
    : `Une journée de formation (${j.raison}) est prévue le ${longue(j.date_journee)}.`
  const { data: auths } = await sb.from('employes').select('id, auth_user_id').in('id', employes.map(e => e.id))
  const authDe = new Map((auths ?? []).map(x => [x.id as string, x.auth_user_id as string | null]))
  const actives = await comptesActives(sb, Array.from(authDe.values()))
  const envoi = await envoyerCourriels(employes.filter(e => e.email && authDe.get(e.id) && actives.has(authDe.get(e.id)!)).map(e => {
    const { html, texte } = gabarit({
      origine, clinique: e.clinique,
      titre: `Journée de formation — ${j.nom}`,
      paragraphes: [
        `Bonjour ${e.prenom ?? ''},`.replace(' ,', ','),
        `${intro} Voici ce que vous aurez à compléter dans votre portail :`,
        ...lignes,
        ...(j.note ? [j.note] : []),
        echeance ? `À compléter avant le ${echeance}.` : 'Vous pouvez commencer dès maintenant.',
      ],
      bouton: { libelle: 'Voir ma journée de formation', lien: `${origine}/dashboard/journees/${j.id}` },
    })
    return { a: e.email!, sujet: `Journée de formation — ${j.nom}`, html, texte }
  }))
  return envoi.envoyes
}

/** Tâche du matin : ouvre les journées programmées dont le jour est arrivé. */
export async function ouvrirJourneesDues(sb: SupabaseClient, origine: string): Promise<{ ouvertes: number; erreurs: string[] }> {
  const { data, error } = await sb.from('journees_formation').select('*')
    .eq('modele', false).is('ouverte_le', null).lte('date_journee', aujourdhui()).limit(100)
  if (error) return { ouvertes: 0, erreurs: /ouverte_le/.test(error.message) ? [] : [error.message] }
  let ouvertes = 0
  const erreurs: string[] = []
  for (const j of (data ?? []) as Journee[]) {
    const { data: createur } = j.cree_par ? await sb.from('employes').select('*').eq('id', j.cree_par).maybeSingle() : { data: null }
    // Auteur archivé ou supprimé : la journée est ouverte au nom d'un administrateur global
    let acteur = createur ? acteurDepuisEmploye(createur) : null
    if (!acteur) {
      const { data: sa } = await sb.from('employes').select('*').eq('role', 'super_admin').eq('actif', true).limit(1).maybeSingle()
      acteur = sa ? acteurDepuisEmploye(sa) : null
    }
    if (!acteur) { erreurs.push(`${j.id} : aucun administrateur pour ouvrir la journée`); continue }
    const r = await ouvrirJournee(sb, acteur, j, origine, { notifier: j.notifier !== false })
    if ('erreur' in r) {
      erreurs.push(`${j.id} : ${r.erreur}`)
      // Plus aucun employé actif : rien à ouvrir, on ne réessaie pas chaque matin
      if (r.statut === 400) await sb.from('journees_formation').update({ ouverte_le: new Date().toISOString() }).eq('id', j.id)
    } else ouvertes++
  }
  return { ouvertes, erreurs }
}
