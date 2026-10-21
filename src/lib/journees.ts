// Journées de formation : un parcours (raison + formations + politiques + éléments de la librairie à visionner)
// lancé pour un ou plusieurs employés. Les modèles (modele = true) se réutilisent d'une journée à l'autre.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Acteur } from '@/lib/permissions'
import type { CliniqueContenu } from '@/lib/cliniques'

const CLINIQUES_CONTENU: CliniqueContenu[] = ['CMC', 'WSSC', 'LES_DEUX']

export const RAISONS_JOURNEE = ['Embauche', 'Retour à l’emploi', 'Mise à niveau annuelle', 'Changement de poste'] as const

export type Journee = {
  id: string
  modele: boolean
  nom: string
  raison: string
  clinique: CliniqueContenu
  formation_ids: string[]
  politique_ids: string[]
  librairie_ids: string[]
  employe_ids: string[]
  date_journee: string | null
  date_echeance: string | null
  note: string | null
  cree_par: string | null
  cree_le: string
}

export const CHAMPS_JOURNEE = 'id, modele, nom, raison, clinique, formation_ids, politique_ids, librairie_ids, employe_ids, date_journee, date_echeance, note, cree_par, cree_le'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ids = (v: unknown, max = 200): string[] =>
  Array.isArray(v) ? Array.from(new Set(v.filter((x): x is string => typeof x === 'string' && UUID.test(x)))).slice(0, max) : []
const texte = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '')
const date = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)

export type DonneesJournee = Omit<Journee, 'id' | 'cree_par' | 'cree_le'>

/** Valide le formulaire. Un modèle n'a pas d'employés ; une journée lancée en a au moins un. */
export function lireJournee(b: Record<string, unknown>, cliniquesPermises: CliniqueContenu[]): { erreur: string } | { valeurs: DonneesJournee } {
  const modele = b.modele === true
  const raison = texte(b.raison, 120)
  if (!raison) return { erreur: 'Indiquez la raison de la journée (ex. : Embauche).' }
  const nom = texte(b.nom, 160) || raison
  const clinique = (CLINIQUES_CONTENU as string[]).includes(b.clinique as string) ? (b.clinique as CliniqueContenu) : null
  if (!clinique || !cliniquesPermises.includes(clinique)) return { erreur: 'Clinique non autorisée' }
  const valeurs: DonneesJournee = {
    modele, nom, raison, clinique,
    formation_ids: ids(b.formation_ids),
    politique_ids: ids(b.politique_ids),
    librairie_ids: ids(b.librairie_ids),
    employe_ids: modele ? [] : ids(b.employe_ids, 500),
    date_journee: modele ? null : date(b.date_journee),
    date_echeance: modele ? null : date(b.date_echeance),
    note: texte(b.note, 1000) || null,
  }
  if (valeurs.formation_ids.length + valeurs.politique_ids.length + valeurs.librairie_ids.length === 0) {
    return { erreur: 'Choisissez au moins une formation, une politique ou un élément à visionner.' }
  }
  if (!modele && valeurs.employe_ids.length === 0) return { erreur: 'Choisissez au moins un employé.' }
  return { valeurs }
}

export function peutGererJournees(a: Acteur | null): boolean {
  return !!a && (a.role === 'super_admin' || a.role === 'admin' || a.role === 'gestionnaire')
}

export type ElementJournee = { id: string; titre: string; type: 'formation' | 'politique' | 'video' | 'lien' | 'document'; url?: string | null }

/** Contenu d'une journée (titres), pour l'affichage. */
export async function contenuJournee(sb: SupabaseClient, j: Pick<Journee, 'formation_ids' | 'politique_ids' | 'librairie_ids'>) {
  const [{ data: f }, { data: p }, { data: l }] = await Promise.all([
    j.formation_ids.length ? sb.from('formations').select('id, titre, publiee').in('id', j.formation_ids) : Promise.resolve({ data: [] }),
    j.politique_ids.length ? sb.from('politiques').select('id, titre, version, actif').in('id', j.politique_ids) : Promise.resolve({ data: [] }),
    j.librairie_ids.length ? sb.from('librairie').select('id, titre, type, url').in('id', j.librairie_ids) : Promise.resolve({ data: [] }),
  ])
  const ordre = <T extends { id: string }>(liste: T[] | null, ordreIds: string[]) =>
    ordreIds.map(id => (liste ?? []).find(x => x.id === id)).filter((x): x is T => !!x)
  return {
    formations: ordre((f ?? []) as { id: string; titre: string; publiee: boolean }[], j.formation_ids),
    politiques: ordre((p ?? []) as { id: string; titre: string; version: number; actif: boolean }[], j.politique_ids),
    librairie: ordre((l ?? []) as { id: string; titre: string; type: 'video' | 'lien' | 'document'; url: string }[], j.librairie_ids),
  }
}
