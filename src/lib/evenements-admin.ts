// Gestion des événements (côté serveur) : droits, validation des champs, inscription, présence.
import type { SupabaseClient } from '@supabase/supabase-js'
import { peutCreerEvenements, cliniquesAdministrees, type Acteur } from '@/lib/permissions'
import { cliniquesDe, type CliniqueEmploye } from '@/lib/cliniques'
import { ROLES_CIBLABLES } from '@/lib/politiques'
import { emettreCertificat } from '@/lib/questionnaire-serveur'
import { premierEnAttente, statutPourNouvelleInscription, type Evenement, type Inscription, type Seance } from '@/lib/evenements'

/** Cliniques possibles pour un événement créé par cette personne. */
export function cliniquesEvenement(a: Acteur): CliniqueEmploye[] {
  if (a.role === 'super_admin') return ['LES_DEUX', 'CMC', 'WSSC']
  if (a.role === 'admin') {
    const cl = cliniquesAdministrees(a)
    return cl.length === 2 ? ['LES_DEUX', ...cl] : cl
  }
  return a.clinique ? [a.clinique] : []
}

/** Peut gérer cet événement : son auteur, ou un administrateur de toutes ses cliniques. */
export function peutGererEvenement(a: Acteur, ev: Pick<Evenement, 'clinique' | 'cree_par'>): boolean {
  if (!peutCreerEvenements(a)) return false
  if (ev.cree_par === a.id) return true
  if (a.role === 'super_admin') return true
  if (a.role === 'admin') {
    const adm = cliniquesAdministrees(a)
    return cliniquesDe(ev.clinique).every(c => adm.includes(c))
  }
  return false
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const liste = (v: unknown) => (Array.isArray(v) ? Array.from(new Set(v.map(x => String(x).trim()).filter(Boolean))) : [])
const texte = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max) || null

/** Valide les champs d'un événement envoyés par le formulaire. */
export function validerEvenement(a: Acteur, c: Record<string, unknown>): { erreur: string } | { valeurs: Record<string, unknown> } {
  const titre = texte(c.titre, 200)
  if (!titre) return { erreur: 'Le titre est obligatoire.' }
  const clinique = String(c.clinique ?? '') as CliniqueEmploye
  if (!cliniquesEvenement(a).includes(clinique)) return { erreur: 'Clinique non autorisée.' }
  const image = texte(c.image, 1000)
  if (image && !/^https:\/\//.test(image)) return { erreur: 'Image invalide.' }
  const heures = Number(c.desinscription_heures ?? 24)
  const duree = c.duree_minutes === null || c.duree_minutes === '' || c.duree_minutes === undefined ? null : Number(c.duree_minutes)
  return {
    valeurs: {
      titre, clinique, image,
      description: texte(c.description, 5000), lieu: texte(c.lieu, 300), responsable: texte(c.responsable, 200),
      departements: liste(c.departements).filter(x => UUID.test(x)),
      employes: liste(c.employes).filter(x => UUID.test(x)).slice(0, 500),
      roles: liste(c.roles).filter(r => (ROLES_CIBLABLES as readonly string[]).includes(r)),
      postes: liste(c.postes).map(x => x.slice(0, 120)).slice(0, 80),
      obligatoire: c.obligatoire === true,
      desinscription_heures: Number.isFinite(heures) ? Math.min(Math.max(Math.round(heures), 0), 24 * 30) : 24,
      formation_id: typeof c.formation_id === 'string' && UUID.test(c.formation_id) ? c.formation_id : null,
      duree_minutes: duree !== null && Number.isFinite(duree) && duree > 0 ? Math.round(duree) : null,
    },
  }
}

/** Valide une séance (dates, places). */
export function validerSeance(c: Record<string, unknown>): { erreur: string } | { valeurs: Pick<Seance, 'debut' | 'fin' | 'places' | 'lieu'> } {
  const debut = new Date(String(c.debut ?? '')), fin = new Date(String(c.fin ?? ''))
  if (isNaN(debut.getTime()) || isNaN(fin.getTime())) return { erreur: 'Date ou heure de séance invalide.' }
  if (fin <= debut) return { erreur: 'L’heure de fin doit être après l’heure de début.' }
  const places = Math.round(Number(c.places))
  if (!Number.isFinite(places) || places < 1 || places > 1000) return { erreur: 'Nombre de places invalide (1 à 1000).' }
  return { valeurs: { debut: debut.toISOString(), fin: fin.toISOString(), places, lieu: texte(c.lieu, 300) } }
}

/**
 * Inscrit l'employé à une séance. Une seule inscription active par événement : changer de séance annule la précédente
 * (et libère sa place pour la liste d'attente). Renvoie le statut obtenu et l'éventuelle personne promue.
 */
export async function inscrire(sb: SupabaseClient, ev: Evenement, seance: Seance, employeId: string, inscriptions: Inscription[]) {
  const actives = inscriptions.filter(i => i.statut !== 'annule')
  const autre = actives.find(i => i.employe_id === employeId && i.seance_id !== seance.id)
  const deja = inscriptions.find(i => i.employe_id === employeId && i.seance_id === seance.id)
  if (deja && deja.statut !== 'annule') return { statut: deja.statut as 'inscrit' | 'attente', promu: null as Inscription | null, ancienneSeance: null as string | null }
  const statut = statutPourNouvelleInscription(seance, actives.filter(i => i.employe_id !== employeId)) as 'inscrit' | 'attente'
  const maintenant = new Date().toISOString()
  if (deja) await sb.from('evenements_inscriptions').update({ statut, inscrit_le: maintenant, annule_le: null, present: null }).eq('id', deja.id)
  else {
    const { error } = await sb.from('evenements_inscriptions').insert({ evenement_id: ev.id, seance_id: seance.id, employe_id: employeId, statut })
    if (error) throw new Error(error.message)
  }
  let promu: Inscription | null = null
  if (autre) {
    const r = await desinscrire(sb, autre, inscriptions)
    promu = r.promu
  }
  return { statut, promu, ancienneSeance: autre?.seance_id ?? null }
}

/** Annule une inscription ; si une place se libère, la première personne de la liste d'attente est inscrite. */
export async function desinscrire(sb: SupabaseClient, ins: Inscription, inscriptions: Inscription[]) {
  await sb.from('evenements_inscriptions').update({ statut: 'annule', annule_le: new Date().toISOString() }).eq('id', ins.id)
  let promu: Inscription | null = null
  if (ins.statut === 'inscrit') {
    promu = premierEnAttente(ins.seance_id, inscriptions.filter(i => i.id !== ins.id))
    if (promu) await sb.from('evenements_inscriptions').update({ statut: 'inscrit' }).eq('id', promu.id)
  }
  return { promu }
}

/** Places ajoutées à une séance : la liste d'attente avance d'autant. */
export async function promouvoirListeAttente(sb: SupabaseClient, seance: Seance, inscriptions: Inscription[]): Promise<Inscription[]> {
  const actives = inscriptions.filter(i => i.seance_id === seance.id)
  let libres = seance.places - actives.filter(i => i.statut === 'inscrit').length
  const promus: Inscription[] = []
  const attente = actives.filter(i => i.statut === 'attente').sort((a, b) => a.inscrit_le.localeCompare(b.inscrit_le))
  for (const i of attente) {
    if (libres <= 0) break
    await sb.from('evenements_inscriptions').update({ statut: 'inscrit' }).eq('id', i.id)
    promus.push(i); libres--
  }
  return promus
}

/**
 * Présence : si l'événement est lié à une formation, chaque personne présente la reçoit comme terminée
 * (assignation si besoin + certificat, avec les heures de la formation) ; elle apparaît dans son dossier et la conformité.
 */
export async function enregistrerPresence(sb: SupabaseClient, ev: Evenement, seanceId: string, presents: string[], absents: string[], par: string) {
  const maintenant = new Date().toISOString()
  if (presents.length) await sb.from('evenements_inscriptions').update({ present: true, presence_le: maintenant }).eq('seance_id', seanceId).in('employe_id', presents)
  if (absents.length) await sb.from('evenements_inscriptions').update({ present: false, presence_le: maintenant }).eq('seance_id', seanceId).in('employe_id', absents)
  let certificats = 0
  if (ev.formation_id && presents.length) {
    const { data: existantes } = await sb.from('assignations').select('employe_id').eq('formation_id', ev.formation_id).in('employe_id', presents)
    const deja = new Set((existantes ?? []).map(x => x.employe_id))
    const nouvelles = presents.filter(id => !deja.has(id))
    if (nouvelles.length) await sb.from('assignations').insert(nouvelles.map(id => ({ employe_id: id, formation_id: ev.formation_id, assigne_par: par, date_assignation: maintenant })))
    for (const id of presents) if (await emettreCertificat(sb, id, ev.formation_id, 100)) certificats++
  }
  return { certificats }
}

/** Données du formulaire : cliniques, ciblage et formations publiées liables. */
export async function optionsEvenement(sb: SupabaseClient, a: Acteur) {
  const { optionsCiblage } = await import('@/lib/politiques')
  const { cliniquesContenuVisibles } = await import('@/lib/permissions')
  const [o, { data: formations }] = await Promise.all([
    optionsCiblage(sb, a),
    sb.from('formations').select('id, titre').eq('publiee', true).in('clinique', cliniquesContenuVisibles(a)).order('titre'),
  ])
  return { cliniques: cliniquesEvenement(a), departements: o.departements, postes: o.postes, familles: o.familles, employes: o.employes, formations: (formations ?? []) as { id: string; titre: string }[] }
}

/** Événements que cette personne peut gérer (liste admin). */
export async function evenementsGerables(sb: SupabaseClient, a: Acteur) {
  const { CHAMPS_EVENEMENT } = await import('@/lib/evenements')
  const { data } = await sb.from('evenements').select(CHAMPS_EVENEMENT).order('created_at', { ascending: false })
  return ((data ?? []) as unknown as Evenement[]).filter(ev => peutGererEvenement(a, ev))
}
