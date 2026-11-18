// Courriels d'information envoyés par les administrateurs (lancements, nouvelles, La Passerelle…).
//  - Destinataires : cliniques, départements, postes ou employés choisis, dans le périmètre de l'administrateur.
//  - Envoi immédiat ou programmé : les envois dus partent dès qu'une page de la plateforme est consultée
//    (et au plus tard avec la tâche quotidienne).
//  - Comme tous les courriels : rien aux comptes pas encore activés (voir envoyerCourriels).
import type { SupabaseClient } from '@supabase/supabase-js'
import { acteurDepuisEmploye, filtrerEmployes, peutVoirEmploye, type Acteur } from '@/lib/permissions'
import { envoyerCourriels, courrielsActifs, type Courriel } from '@/lib/courriels'
import { adressesNonActivees } from '@/lib/comptes-actives'
import { rendreCourriel } from '@/lib/notifications-catalogue'
import { estAdministrateur, cliniquesDe } from '@/lib/cliniques'
import { logAudit } from '@/lib/audit'

export type CibleInfo =
  | { type: 'cliniques'; cliniques: ('WSSC' | 'CMC')[] }
  | { type: 'departements'; ids: string[] }
  | { type: 'postes'; postes: string[] }
  | { type: 'employes'; ids: string[] }

export type CourrielInfo = {
  id: string; objet: string; contenu: string; bouton_libelle: string; bouton_lien: string; cible: CibleInfo
  statut: 'brouillon' | 'programme' | 'envoi' | 'envoye' | 'annule' | 'erreur'; envoi_prevu: string; envoye_le: string | null
  nb_destinataires: number | null; nb_envoyes: number | null; nb_non_actives: number | null; erreur: string | null; cree_par: string | null; cree_le: string
}

export const peutEnvoyerInformation = (a: { role: string } | null) => !!a && estAdministrateur(a.role)

const UUID = /^[0-9a-f-]{36}$/i
const texte = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)

/** Valide le formulaire. Lien du bouton : https://… ou page de la plateforme (/…). */
export function lireCourrielInfo(c: Record<string, unknown>, options: { brouillon?: boolean } = {}): { valeurs: Omit<CourrielInfo, 'id' | 'statut' | 'envoye_le' | 'nb_destinataires' | 'nb_envoyes' | 'nb_non_actives' | 'erreur' | 'cree_par' | 'cree_le'> } | { erreur: string } {
  const objet = texte(c.objet, 200)
  const contenu = texte(c.contenu, 10000)
  if (!objet) return { erreur: 'L’objet est requis.' }
  if (!contenu) return { erreur: 'Le message est vide.' }
  // Brouillon : les destinataires peuvent rester à choisir
  const cible = lireCible(c.cible) ?? (options.brouillon ? { type: 'cliniques' as const, cliniques: [] } : null)
  if (!cible) return { erreur: 'Choisissez les destinataires.' }
  const libelle = texte(c.bouton_libelle, 60)
  const lien = texte(c.bouton_lien, 500)
  if (libelle && !/^(https:\/\/|\/)/.test(lien)) return { erreur: 'Le lien du bouton doit commencer par https:// ou / (page de la plateforme).' }
  let prevu = new Date()
  if (c.envoi_prevu) {
    const d = new Date(String(c.envoi_prevu))
    if (isNaN(d.getTime())) return { erreur: 'Date d’envoi invalide.' }
    if (d.getTime() > Date.now() + 365 * 86400_000) return { erreur: 'Date d’envoi trop lointaine.' }
    prevu = d
  }
  return { valeurs: { objet, contenu, bouton_libelle: libelle, bouton_lien: libelle ? lien : '', cible, envoi_prevu: prevu.toISOString() } }
}

export function lireCible(v: unknown): CibleInfo | null {
  const c = (v ?? {}) as Record<string, unknown>
  const ids = (x: unknown) => (Array.isArray(x) ? x : []).filter((i): i is string => typeof i === 'string' && UUID.test(i)).slice(0, 1000)
  if (c.type === 'cliniques') {
    const l = (Array.isArray(c.cliniques) ? c.cliniques : []).filter((x): x is 'WSSC' | 'CMC' => x === 'WSSC' || x === 'CMC')
    return l.length ? { type: 'cliniques', cliniques: Array.from(new Set(l)) } : null
  }
  if (c.type === 'departements') { const l = ids(c.ids); return l.length ? { type: 'departements', ids: l } : null }
  if (c.type === 'employes') { const l = ids(c.ids); return l.length ? { type: 'employes', ids: l } : null }
  if (c.type === 'postes') {
    const l = (Array.isArray(c.postes) ? c.postes : []).map(p => texte(p, 150)).filter(Boolean).slice(0, 200)
    return l.length ? { type: 'postes', postes: l } : null
  }
  return null
}

export type Destinataire = { id: string; prenom: string | null; nom: string | null; email: string | null; clinique: string | null }

/** Employés actifs visés, dans le périmètre de l'administrateur. */
export async function destinataires(sb: SupabaseClient, a: Acteur, cible: CibleInfo): Promise<Destinataire[]> {
  const champs = 'id, prenom, nom, email, clinique, role, departement_id'
  let q = filtrerEmployes(sb.from('employes').select(champs).or('actif.is.null,actif.eq.true'), a)
  if (cible.type === 'cliniques') {
    const voulues = cible.cliniques
    q = q.in('clinique', [...voulues, 'LES_DEUX'])
  } else if (cible.type === 'departements') q = q.in('departement_id', cible.ids)
  else if (cible.type === 'postes') q = q.in('poste', cible.postes)
  else q = q.in('id', cible.ids)
  const { data } = await q.limit(5000)
  const lignes = (data ?? []) as (Destinataire & { role: string; departement_id: string | null })[]
  return lignes.filter(e => e.email && peutVoirEmploye(a, e))
}

const lienAbsolu = (lien: string, origine: string) => (lien.startsWith('/') ? origine + lien : lien)

/** Courriel d'un destinataire (« Bonjour Prénom, » puis le message, listes et gras permis). */
export function composer(c: Pick<CourrielInfo, 'objet' | 'contenu' | 'bouton_libelle' | 'bouton_lien'>, d: Pick<Destinataire, 'prenom' | 'clinique'>, origine: string): { html: string; texte: string } {
  return rendreCourriel({
    origine, clinique: d.clinique, destinataire: d.prenom || null, titre: c.objet,
    message: c.contenu, vars: {}, riche: true, introBouton: null,
    bouton: c.bouton_libelle && c.bouton_lien ? { libelle: c.bouton_libelle, lien: lienAbsolu(c.bouton_lien, origine) } : null,
  })
}

/** Envoie un courriel d'information déjà enregistré (statut « envoi »), met à jour son bilan. */
export async function envoyerInformation(sb: SupabaseClient, c: CourrielInfo, origine: string): Promise<{ envoyes: number; destinataires: number; nonActives: number; erreur?: string }> {
  const { data: auteur } = c.cree_par ? await sb.from('employes').select('*').eq('id', c.cree_par).maybeSingle() : { data: null }
  const a = auteur ? acteurDepuisEmploye(auteur) : null
  if (!a || !peutEnvoyerInformation(a)) {
    await sb.from('courriels_information').update({ statut: 'erreur', erreur: 'Auteur introuvable ou sans droit d’envoi' }).eq('id', c.id)
    return { envoyes: 0, destinataires: 0, nonActives: 0, erreur: 'Auteur introuvable' }
  }
  const liste = await destinataires(sb, a, c.cible)
  const non = await adressesNonActivees(sb, liste.map(d => d.email!)).catch(() => new Set<string>())
  const courriels: Courriel[] = liste.map(d => ({ a: d.email!, sujet: c.objet, ...composer(c, d, origine) }))
  const r = courrielsActifs() ? await envoyerCourriels(courriels) : { envoyes: 0, erreur: 'non_configure' }
  await sb.from('courriels_information').update({
    statut: r.erreur && r.envoyes === 0 && liste.length - non.size > 0 ? 'erreur' : 'envoye', envoye_le: new Date().toISOString(),
    nb_destinataires: liste.length, nb_envoyes: r.envoyes, nb_non_actives: non.size, erreur: r.erreur ?? null,
  }).eq('id', c.id)
  await logAudit({
    acteur_id: a.id, type_action: 'PARAMETRE_MODIFIE',
    description: `Courriel d’information « ${c.objet} » envoyé : ${r.envoyes} courriel(s) sur ${liste.length} destinataire(s) (${non.size} compte(s) pas encore activé(s))`,
    metadata: { courriel_information_id: c.id, cible: c.cible },
  })
  return { envoyes: r.envoyes, destinataires: liste.length, nonActives: non.size, erreur: r.erreur }
}

/** Envoie les courriels programmés dont l'heure est passée (chacun n'est pris qu'une fois). */
export async function envoyerCourrielsDus(sb: SupabaseClient, origine: string): Promise<number> {
  const { data, error } = await sb.from('courriels_information').select('id').eq('statut', 'programme').lte('envoi_prevu', new Date().toISOString()).limit(5)
  if (error || !data?.length) return 0
  let n = 0
  for (const { id } of data) {
    const { data: pris } = await sb.from('courriels_information').update({ statut: 'envoi' }).eq('id', id).eq('statut', 'programme').select('*').maybeSingle()
    if (!pris) continue
    await envoyerInformation(sb, pris as CourrielInfo, origine)
    n++
  }
  return n
}

/** Libellé lisible d'une cible (historique). */
export function libelleCible(c: CibleInfo, noms: { departements?: Map<string, string>; employes?: Map<string, string> } = {}): string {
  if (c.type === 'cliniques') return c.cliniques.length === 2 ? 'Tous les employés (WSSC et CMC)' : `Tous les employés du ${c.cliniques[0]}`
  if (c.type === 'departements') return 'Départements : ' + c.ids.map(i => noms.departements?.get(i) ?? '?').join(', ')
  if (c.type === 'postes') return 'Postes : ' + c.postes.join(', ')
  const n = c.ids.map(i => noms.employes?.get(i)).filter(Boolean)
  return n.length <= 3 ? 'Employés : ' + n.join(', ') : `${c.ids.length} employés choisis`
}

/** Cliniques que l'administrateur peut viser */
export const cliniquesPermises = (a: { role: string; clinique: string | null }): ('WSSC' | 'CMC')[] =>
  a.role === 'super_admin' ? ['WSSC', 'CMC'] : (cliniquesDe(a.clinique) as ('WSSC' | 'CMC')[])
