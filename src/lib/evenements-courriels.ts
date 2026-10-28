// Courriels des événements : annonce, confirmation, liste d'attente, changements, rappels, relances, sondage.
import type { SupabaseClient } from '@supabase/supabase-js'
import { courrielsActifs, envoyerCourriels, gabarit, type Courriel } from '@/lib/courriels'
import { chargerNotifications, composerNotification, modeleEnVigueur, type ConfigNotifications } from '@/lib/notifications-courriel'
import { estInvite, placesRestantes, seanceOuverte, type Evenement, type Seance, type Inscription } from '@/lib/evenements'

type Personne = { id: string; prenom: string | null; nom?: string | null; email: string | null; clinique: string | null; role?: string | null; departement_id: string | null; poste?: string | null; actif?: boolean | null }

const quand = (s: Pick<Seance, 'debut' | 'fin'>) => {
  const d = new Date(s.debut), f = new Date(s.fin)
  const jour = d.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Toronto' })
  const h = (x: Date) => x.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Toronto' })
  return `${jour}, de ${h(d)} à ${h(f)}`
}

function courriel(origine: string, e: Personne, sujet: string, paragraphes: string[], bouton: { libelle: string; lien: string }): Courriel | null {
  if (!e.email) return null
  const { html, texte } = gabarit({ origine, clinique: e.clinique, titre: sujet, paragraphes: [`Bonjour ${e.prenom ?? ''},`.replace(' ,', ','), ...paragraphes], bouton })
  return { a: e.email, sujet, html, texte }
}

/** Notification personnalisable (Admin → Paramètres → Notifications) ; null si désactivée. */
function notif(cfg: ConfigNotifications, cle: string, origine: string, e: Personne, ev: Evenement, s: Seance | null, lien: string): Courriel | null {
  return composerNotification(cfg, cle, {
    a: e.email, origine, clinique: e.clinique, prenom: e.prenom, nom: e.nom ?? null, lien,
    vars: {
      activite: ev.titre, date: s ? quand(s) : '', lieu: s && (s.lieu || ev.lieu) ? `Lieu : ${s.lieu || ev.lieu}` : '',
      calendrier: s ? `Ajouter à votre calendrier : ${lienIcs(origine, ev, s)}` : '',
    },
  })
}

const lienEvenement = (origine: string, ev: Pick<Evenement, 'id'>) => `${origine}/dashboard/evenements/${ev.id}`
const lienIcs = (origine: string, ev: Pick<Evenement, 'id'>, s: Pick<Seance, 'id'>) => `${origine}/api/evenements/${ev.id}/calendrier?seance=${s.id}`
const lieu = (ev: Evenement, s: Seance) => (s.lieu || ev.lieu ? [`Lieu : ${s.lieu || ev.lieu}`] : [])

async function envoyer(liste: (Courriel | null)[]) {
  if (!courrielsActifs()) return 0
  const c = liste.filter((x): x is Courriel => !!x)
  if (!c.length) return 0
  return (await envoyerCourriels(c)).envoyes
}

/** Employés actifs invités à l'événement. */
export async function invitesDe(sb: SupabaseClient, ev: Evenement): Promise<Personne[]> {
  const { data } = await sb.from('employes').select('id, prenom, nom, email, clinique, role, departement_id, poste, actif').or('actif.is.null,actif.eq.true')
  return ((data ?? []) as Personne[]).filter(e => estInvite(ev, e))
}

async function personnes(sb: SupabaseClient, ids: string[]): Promise<Map<string, Personne>> {
  if (!ids.length) return new Map()
  const { data } = await sb.from('employes').select('id, prenom, nom, email, clinique, role, departement_id, poste, actif').in('id', ids)
  return new Map(((data ?? []) as Personne[]).filter(e => e.actif !== false).map(e => [e.id, e]))
}

/** Annonce d'un événement publié à toutes les personnes invitées. */
export async function annoncerEvenement(sb: SupabaseClient, ev: Evenement, seances: Seance[], origine: string) {
  const invites = await invitesDe(sb, ev)
  const dates = seances.filter(s => seanceOuverte(s)).map(s => `• ${quand(s)}`)
  const cfg = await chargerNotifications(sb)
  if (!modeleEnVigueur(cfg, 'nouvelle_session_participants')?.actif) return 0
  if (cfg.modeles.has('nouvelle_session_participants')) return envoyer(invites.map(e => notif(cfg, 'nouvelle_session_participants', origine, e, ev, null, lienEvenement(origine, ev))))
  return envoyer(invites.map(e => courriel(origine, e, `${ev.obligatoire ? 'Formation obligatoire' : 'Nouvelle formation en présentiel'} : ${ev.titre}`, [
    `Une formation en présentiel vous est proposée : « ${ev.titre} ».`,
    ...(ev.description ? [ev.description.slice(0, 500)] : []),
    ...(dates.length ? ['Dates proposées :', ...dates] : []),
    ev.obligatoire ? 'Cette formation est obligatoire : inscrivez-vous à l’une des dates.' : 'Les places sont limitées : inscrivez-vous à la date qui vous convient.',
  ], { libelle: 'S’inscrire', lien: lienEvenement(origine, ev) })))
}

/** Confirmation d'inscription (ou de mise en liste d'attente). */
export async function confirmerInscription(sb: SupabaseClient, ev: Evenement, s: Seance, employeId: string, statut: 'inscrit' | 'attente', origine: string) {
  const e = (await personnes(sb, [employeId])).get(employeId)
  if (!e) return 0
  const cfg = await chargerNotifications(sb)
  return envoyer([statut === 'inscrit'
    ? notif(cfg, 'inscription_occurrence', origine, e, ev, s, lienEvenement(origine, ev))
    : courriel(origine, e, `Liste d’attente : ${ev.titre}`, [`La séance du ${quand(s)} est complète. Vous êtes sur la liste d’attente.`, 'Si une place se libère, vous serez inscrit(e) automatiquement et prévenu(e) par courriel.'], { libelle: 'Voir l’événement', lien: lienEvenement(origine, ev) })])
}

/** Une place s'est libérée : la personne passe de la liste d'attente à inscrite. */
export async function avertirPromotion(sb: SupabaseClient, ev: Evenement, s: Seance, employeId: string, origine: string) {
  const e = (await personnes(sb, [employeId])).get(employeId)
  if (!e) return 0
  const cfg = await chargerNotifications(sb)
  return envoyer([notif(cfg, 'liste_attente_ouverture', origine, e, ev, s, lienEvenement(origine, ev))])
}

/** Séance modifiée ou annulée : les inscrits (et la liste d'attente) sont prévenus. */
export async function avertirChangementSeance(sb: SupabaseClient, ev: Evenement, s: Seance, inscriptions: Inscription[], motif: 'modifiee' | 'annulee', origine: string) {
  const ids = inscriptions.filter(i => i.seance_id === s.id && i.statut !== 'annule').map(i => i.employe_id)
  const pers = await personnes(sb, ids)
  const cfg = await chargerNotifications(sb)
  const cle = motif === 'annulee' ? 'session_annulee_participants' : 'modification_occurrence'
  return envoyer(Array.from(pers.values()).map(e => cfg.modeles.has(cle) || motif === 'modifiee' ? notif(cfg, cle, origine, e, ev, s, lienEvenement(origine, ev)) : !modeleEnVigueur(cfg, cle)?.actif ? null : courriel(origine, e,
    motif === 'annulee' ? `Séance annulée : ${ev.titre}` : `Séance modifiée : ${ev.titre}`,
    motif === 'annulee'
      ? [`La séance de « ${ev.titre} » du ${quand(s)} est annulée.`, 'Vous pouvez vous inscrire à une autre date dans votre portail.']
      : [`La séance de « ${ev.titre} » a été modifiée.`, `Nouvelle date : ${quand(s)}`, ...lieu(ev, s), `Mettre à jour votre calendrier : ${lienIcs(origine, ev, s)}`],
    { libelle: 'Voir l’événement', lien: lienEvenement(origine, ev) })))
}

/** Événement annulé : tous les inscrits sont prévenus. */
export async function avertirAnnulationEvenement(sb: SupabaseClient, ev: Evenement, inscriptions: Inscription[], origine: string) {
  const pers = await personnes(sb, Array.from(new Set(inscriptions.filter(i => i.statut !== 'annule').map(i => i.employe_id))))
  const cfg = await chargerNotifications(sb)
  return envoyer(Array.from(pers.values()).map(e => notif(cfg, 'annulation_occurrence', origine, e, ev, null, `${origine}/dashboard/evenements`)))
}

/**
 * Tâche quotidienne :
 *  - rappel la veille aux inscrits (séances qui commencent dans les 36 prochaines heures) ;
 *  - relance des invités non inscrits pour un événement obligatoire, 7 et 3 jours avant la dernière séance ouverte ;
 *  - après la séance, lien vers le sondage de satisfaction (si l'événement est lié à une formation).
 */
export async function tachesEvenements(sb: SupabaseClient, origine: string, maintenant = new Date()) {
  const bilan = { rappels: 0, relances: 0, sondages: 0 }
  if (!courrielsActifs()) return bilan
  const cfg = await chargerNotifications(sb)
  const { data: evs } = await sb.from('evenements').select('*').eq('statut', 'publie')
  for (const ev of (evs ?? []) as Evenement[]) {
    const { data: ss } = await sb.from('evenements_seances').select('*').eq('evenement_id', ev.id)
    const { data: ins } = await sb.from('evenements_inscriptions').select('*').eq('evenement_id', ev.id).neq('statut', 'annule')
    const seances = (ss ?? []) as Seance[]
    const inscriptions = (ins ?? []) as Inscription[]

    for (const s of seances.filter(x => !x.annulee)) {
      const dans = new Date(s.debut).getTime() - maintenant.getTime()
      if (!s.rappel_envoye && dans > 0 && dans <= 36 * 3600_000) {
        const pers = await personnes(sb, inscriptions.filter(i => i.seance_id === s.id && i.statut === 'inscrit').map(i => i.employe_id))
        bilan.rappels += await envoyer(Array.from(pers.values()).map(e => notif(cfg, 'rappel_evenement', origine, e, ev, s, lienEvenement(origine, ev))))
        await sb.from('evenements_seances').update({ rappel_envoye: true }).eq('id', s.id)
      }
      const depuisFin = maintenant.getTime() - new Date(s.fin).getTime()
      if (ev.formation_id && !s.sondage_envoye && depuisFin > 2 * 3600_000 && depuisFin < 7 * 24 * 3600_000) {
        const pers = await personnes(sb, inscriptions.filter(i => i.seance_id === s.id && i.present === true).map(i => i.employe_id))
        bilan.sondages += await envoyer(Array.from(pers.values()).map(e => notif(cfg, 'invitation_sondage', origine, e, ev, s, `${origine}/formations/${ev.formation_id}/sondage`)))
        await sb.from('evenements_seances').update({ sondage_envoye: true }).eq('id', s.id)
      }
    }

    if (ev.obligatoire) {
      const ouvertes = seances.filter(s => seanceOuverte(s, maintenant) && placesRestantes(s, inscriptions) > 0)
      const derniere = ouvertes.map(s => new Date(s.debut).getTime()).sort((a, b) => b - a)[0]
      const jours = derniere ? Math.round((derniere - maintenant.getTime()) / 86400_000) : -1
      if (jours === 7 || jours === 3) {
        const inscrits = new Set(inscriptions.map(i => i.employe_id))
        const nonInscrits = (await invitesDe(sb, ev)).filter(e => !inscrits.has(e.id))
        bilan.relances += await envoyer(nonInscrits.map(e => courriel(origine, e, `Formation obligatoire : inscrivez-vous — ${ev.titre}`, [`Vous n’êtes pas encore inscrit(e) à la formation obligatoire « ${ev.titre} ».`, 'Dates encore disponibles :', ...ouvertes.map(s => `• ${quand(s)}`)], { libelle: 'S’inscrire', lien: lienEvenement(origine, ev) })))
      }
    }
  }
  return bilan
}
