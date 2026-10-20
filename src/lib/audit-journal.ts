// Consultation du journal d'audit : libellés, filtres (types, clinique, département, employés, dates)
// et requête limitée à la portée de l'administrateur. Côté serveur pour la requête.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Acteur } from '@/lib/permissions'
import { filtrerEmployes } from '@/lib/permissions'

import { LIBELLES_AUDIT, type LigneAudit } from '@/lib/audit-journal-libelles'
export { LIBELLES_AUDIT, GROUPES_AUDIT, libelleAudit, type LigneAudit } from '@/lib/audit-journal-libelles'

export type FiltresAudit = {
  types: string[]
  clinique: 'CMC' | 'WSSC' | null
  departement_id: string | null
  employe_ids: string[]
  date_debut: string | null
  date_fin: string | null
  recherche: string | null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/

/** Lit et valide les filtres de l'URL (les valeurs inconnues sont ignorées). */
export function lireFiltresAudit(sp: URLSearchParams): FiltresAudit {
  const liste = (k: string) => (sp.get(k) ?? '').split(',').map(s => s.trim()).filter(Boolean)
  const cl = sp.get('clinique')
  const dep = sp.get('departement')
  const d1 = sp.get('date_debut'), d2 = sp.get('date_fin')
  return {
    types: liste('types').filter(t => t in LIBELLES_AUDIT),
    clinique: cl === 'CMC' || cl === 'WSSC' ? cl : null,
    departement_id: dep && UUID.test(dep) ? dep : null,
    employe_ids: liste('employes').filter(id => UUID.test(id)).slice(0, 200),
    date_debut: d1 && DATE.test(d1) ? d1 : null,
    date_fin: d2 && DATE.test(d2) ? d2 : null,
    // Caractères qui casseraient le filtre PostgREST retirés
    recherche: (sp.get('recherche') ?? '').replace(/[,()%*\\]/g, ' ').trim().slice(0, 80) || null,
  }
}

export type EmployeAudit = { id: string; prenom: string | null; nom: string | null; email: string | null; clinique: string | null; departement_id: string | null }

/**
 * Employés concernés par la recherche : ceux de la portée de l'acteur, réduits par clinique / département / sélection.
 * null = aucune restriction (admin global sans filtre de personne).
 */
export async function employesConcernes(sb: SupabaseClient, acteur: Acteur, f: FiltresAudit): Promise<EmployeAudit[] | null> {
  const restreint = acteur.role !== 'super_admin' || f.clinique || f.departement_id || f.employe_ids.length > 0
  if (!restreint) return null
  let q = filtrerEmployes(sb.from('employes').select('id, prenom, nom, email, clinique, departement_id'), acteur)
  if (f.clinique) q = q.in('clinique', [f.clinique, 'LES_DEUX'])
  if (f.departement_id) q = q.eq('departement_id', f.departement_id)
  if (f.employe_ids.length) q = q.in('id', f.employe_ids)
  const { data } = await q
  return (data ?? []) as EmployeAudit[]
}

export const CHAMPS_AUDIT = `id, created_at, type_action, description, formation_id, acteur_id, cible_employe_id, metadata, ip_address, user_agent,
  acteur:employes!audit_logs_acteur_id_fkey(id, prenom, nom, email, role, clinique),
  cible:employes!audit_logs_cible_employe_id_fkey(id, prenom, nom, email)`


/** Début ou fin d'une journée à l'heure de Montréal (heure d'été ou normale), en ISO. */
export function borneToronto(jour: string, fin: boolean): string {
  const midi = new Date(jour + 'T12:00:00Z')
  const nom = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Toronto', timeZoneName: 'shortOffset' })
    .formatToParts(midi).find(p => p.type === 'timeZoneName')?.value ?? 'GMT-5'
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(nom)
  const decalage = m ? `${m[1]}${m[2].padStart(2, '0')}:${m[3] ?? '00'}` : '-05:00'
  return `${jour}T${fin ? '23:59:59.999' : '00:00:00'}${decalage}`
}

/** Requête filtrée (sans pagination appliquée). Renvoie null si la portée est vide. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function requeteAudit(sb: SupabaseClient, f: FiltresAudit, ids: string[] | null, options?: { compter?: boolean }): any | null {
  if (ids && ids.length === 0) return null
  let q = sb.from('audit_logs').select(CHAMPS_AUDIT, options?.compter ? { count: 'exact' } : undefined)
    .order('created_at', { ascending: false })
  if (ids) {
    const liste = ids.join(',')
    q = q.or(`acteur_id.in.(${liste}),cible_employe_id.in.(${liste})`)
  }
  if (f.types.length) q = q.in('type_action', f.types)
  if (f.date_debut) q = q.gte('created_at', borneToronto(f.date_debut, false))
  if (f.date_fin) q = q.lte('created_at', borneToronto(f.date_fin, true))
  if (f.recherche) q = q.ilike('description', `%${f.recherche}%`)
  return q
}

/** Une entrée concerne-t-elle cet employé (auteur de l'action ou personne visée) ? */
export const concerne = (l: Pick<LigneAudit, 'acteur_id' | 'cible_employe_id'>, employeId: string) =>
  l.acteur_id === employeId || l.cible_employe_id === employeId
