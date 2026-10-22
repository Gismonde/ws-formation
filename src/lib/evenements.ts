// Événements de formation en présentiel : séances avec places, inscriptions, liste d'attente, présence.
// Règles pures (testées) + accès aux données côté serveur.
import type { SupabaseClient } from '@supabase/supabase-js'
import { estVise, type CiblePolitique } from '@/lib/politiques'

export type StatutEvenement = 'brouillon' | 'publie' | 'annule'

export type Evenement = CiblePolitique & {
  id: string
  titre: string
  description: string | null
  image: string | null
  lieu: string | null
  responsable: string | null
  obligatoire: boolean
  desinscription_heures: number
  formation_id: string | null
  duree_minutes: number | null
  statut: StatutEvenement
  publie_le: string | null
  cree_par: string | null
  created_at: string
}

export type Seance = {
  id: string
  evenement_id: string
  debut: string
  fin: string
  places: number
  lieu: string | null
  annulee: boolean
  rappel_envoye?: boolean
  sondage_envoye?: boolean
}

export type StatutInscription = 'inscrit' | 'attente' | 'annule'

export type Inscription = {
  id: string
  evenement_id: string
  seance_id: string
  employe_id: string
  statut: StatutInscription
  present: boolean | null
  inscrit_le: string
  annule_le: string | null
}

export const CHAMPS_EVENEMENT = 'id, titre, description, image, lieu, responsable, clinique, departements, employes, roles, postes, obligatoire, desinscription_heures, formation_id, duree_minutes, statut, publie_le, cree_par, created_at'

// ---------------------------------------------------------------------------
// Règles

/** L'employé fait-il partie du public de l'événement ? (même ciblage que les politiques) */
export function estInvite(ev: Pick<Evenement, 'clinique' | 'departements' | 'employes' | 'roles' | 'postes'>, e: Parameters<typeof estVise>[1]): boolean {
  return estVise(ev, e)
}

export function inscritsDe(seanceId: string, inscriptions: Pick<Inscription, 'seance_id' | 'statut'>[]): number {
  return inscriptions.filter(i => i.seance_id === seanceId && i.statut === 'inscrit').length
}

export function placesRestantes(s: Pick<Seance, 'id' | 'places'>, inscriptions: Pick<Inscription, 'seance_id' | 'statut'>[]): number {
  return Math.max(0, s.places - inscritsDe(s.id, inscriptions))
}

/** Une séance est-elle encore ouverte aux inscriptions ? */
export function seanceOuverte(s: Pick<Seance, 'debut' | 'annulee'>, maintenant = new Date()): boolean {
  return !s.annulee && new Date(s.debut).getTime() > maintenant.getTime()
}

/** Date limite pour se désinscrire (X heures avant le début). */
export function limiteDesinscription(s: Pick<Seance, 'debut'>, heures: number): Date {
  return new Date(new Date(s.debut).getTime() - Math.max(0, heures) * 3600_000)
}

export function peutSeDesinscrire(s: Pick<Seance, 'debut' | 'annulee'>, heures: number, maintenant = new Date()): boolean {
  return !s.annulee && maintenant.getTime() < limiteDesinscription(s, heures).getTime()
}

/** Inscription : place libre → inscrit, sinon liste d'attente. */
export function statutPourNouvelleInscription(s: Pick<Seance, 'id' | 'places'>, inscriptions: Pick<Inscription, 'seance_id' | 'statut'>[]): StatutInscription {
  return placesRestantes(s, inscriptions) > 0 ? 'inscrit' : 'attente'
}

/** Prochaine personne de la liste d'attente (la plus ancienne). */
export function premierEnAttente<T extends Pick<Inscription, 'seance_id' | 'statut' | 'inscrit_le'>>(seanceId: string, inscriptions: T[]): T | null {
  return inscriptions.filter(i => i.seance_id === seanceId && i.statut === 'attente')
    .sort((a, b) => a.inscrit_le.localeCompare(b.inscrit_le))[0] ?? null
}

// ---------------------------------------------------------------------------
// Calendrier (.ics)

const ics = (d: string | Date) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const echapper = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, m => '\\' + m)

/** Fichier .ics d'une séance (Outlook, Google, Apple). */
export function fichierIcs(ev: Pick<Evenement, 'id' | 'titre' | 'description' | 'lieu'>, s: Pick<Seance, 'id' | 'debut' | 'fin' | 'lieu'>, lien: string): string {
  const lignes = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//WS Formation//Evenements//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${s.id}@ws-formation`,
    `DTSTAMP:${ics(new Date())}`,
    `DTSTART:${ics(s.debut)}`,
    `DTEND:${ics(s.fin)}`,
    `SUMMARY:${echapper(ev.titre)}`,
    ...(s.lieu || ev.lieu ? [`LOCATION:${echapper((s.lieu || ev.lieu)!)}`] : []),
    `DESCRIPTION:${echapper(((ev.description ?? '').slice(0, 800) + '\n\n' + lien).trim())}`,
    `URL:${lien}`,
    'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', `DESCRIPTION:${echapper(ev.titre)}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ]
  return lignes.join('\r\n') + '\r\n'
}

// ---------------------------------------------------------------------------
// Données

export async function evenementsDisponibles(sb: SupabaseClient): Promise<boolean> {
  const { error } = await sb.from('evenements').select('id', { head: true, count: 'exact' }).limit(1)
  return !error
}

export async function chargerEvenement(sb: SupabaseClient, id: string) {
  const [{ data: ev }, { data: seances }, { data: inscriptions }] = await Promise.all([
    sb.from('evenements').select(CHAMPS_EVENEMENT).eq('id', id).maybeSingle(),
    sb.from('evenements_seances').select('*').eq('evenement_id', id).order('debut'),
    sb.from('evenements_inscriptions').select('*').eq('evenement_id', id),
  ])
  if (!ev) return null
  return { ev: ev as Evenement, seances: (seances ?? []) as Seance[], inscriptions: (inscriptions ?? []) as Inscription[] }
}

/** Événements publiés auxquels l'employé est invité, avec son inscription éventuelle. */
export async function evenementsDeLEmploye(sb: SupabaseClient, e: { id: string; clinique: string | null; role?: string | null; departement_id: string | null; poste?: string | null }) {
  if (!(await evenementsDisponibles(sb))) return []
  const { data: evs } = await sb.from('evenements').select(CHAMPS_EVENEMENT).eq('statut', 'publie').order('created_at', { ascending: false })
  const invites = ((evs ?? []) as Evenement[]).filter(ev => estInvite(ev, e))
  if (!invites.length) return []
  const ids = invites.map(v => v.id)
  const [{ data: seances }, { data: inscriptions }] = await Promise.all([
    sb.from('evenements_seances').select('*').in('evenement_id', ids).order('debut'),
    sb.from('evenements_inscriptions').select('seance_id, evenement_id, statut, employe_id, inscrit_le, present').in('evenement_id', ids).neq('statut', 'annule'),
  ])
  return invites.map(ev => {
    const ss = ((seances ?? []) as Seance[]).filter(s => s.evenement_id === ev.id)
    const ins = ((inscriptions ?? []) as Inscription[]).filter(i => i.evenement_id === ev.id)
    const mienne = ins.find(i => i.employe_id === e.id) ?? null
    const prochaine = ss.filter(s => !s.annulee).map(s => s.debut).sort()[0] ?? null
    const termine = ss.length > 0 && ss.every(s => s.annulee || new Date(s.fin).getTime() < Date.now())
    return { ev, seances: ss.map(s => ({ ...s, restantes: placesRestantes(s, ins) })), mienne, prochaine, termine }
  })
}

/** Nombre d'événements ouverts où l'employé n'est pas encore inscrit (badge du menu). */
export async function nombreEvenementsAInscrire(sb: SupabaseClient, e: Parameters<typeof evenementsDeLEmploye>[1]): Promise<number> {
  try {
    return (await evenementsDeLEmploye(sb, e)).filter(x => !x.mienne && !x.termine && x.seances.some(s => seanceOuverte(s))).length
  } catch {
    return 0
  }
}
