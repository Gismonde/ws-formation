// Accès aux formations hors assignation (« Formations disponibles ») : libre ou sur demande. Côté serveur.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Acteur } from '@/lib/permissions'
import { peutGererContenu, cliniquesContenuVisibles } from '@/lib/permissions'
import { responsableAdmissible, cliniquesDe } from '@/lib/cliniques'
import { chargerVersions, garderLaLangue, langueEmploye } from '@/lib/langues-formation'

export type ModeAcces = 'aucun' | 'libre' | 'demande'
export type StatutDemande = 'en_attente' | 'acceptee' | 'refusee'

export type FormationDisponible = {
  id: string; titre: string; description: string | null; categorie: string | null; niveau: string | null
  duree_estimee_minutes: number | null; image_couverture: string | null
  mode: 'libre' | 'demande'; inscrit: boolean; demande: StatutDemande | null; motif: string | null
}

export type DemandeAcces = {
  id: string; employe_id: string; statut: StatutDemande; message: string | null; demandee_le: string
  traitee_le: string | null; motif: string | null; nom: string; poste: string | null; traitee_par_nom: string | null
  /** Version demandée (française ou anglaise) */
  formation_id: string; langue: 'fr' | 'en'
}

/** Formations publiées ouvertes hors assignation dans l'espace ; [] tant que la migration n'est pas exécutée. */
export async function formationsDisponibles(sb: SupabaseClient, employeId: string, cliniques: string[]): Promise<FormationDisponible[]> {
  const { data, error } = await sb.from('formations')
    .select('id, titre, description, categorie, niveau, duree_estimee_minutes, image_couverture, acces_hors_assignation')
    .eq('publiee', true).in('acces_hors_assignation', ['libre', 'demande']).in('clinique', cliniques)
    .order('titre')
  if (error || !data?.length) return []
  // Versions FR / EN : seulement celle de la langue de formation de l'employé
  const [versions, langue] = await Promise.all([chargerVersions(sb, data.map(f => f.id as string)), langueEmploye(sb, employeId)])
  const visibles = garderLaLangue(data as { id: string }[], versions, langue) as typeof data
  const ids = visibles.map(f => f.id as string)
  const familles = Array.from(new Set(ids.flatMap(id => versions.famille(id))))
  const [{ data: ass }, { data: dem }] = await Promise.all([
    sb.from('assignations').select('formation_id').eq('employe_id', employeId).in('formation_id', familles),
    sb.from('demandes_acces_formation').select('formation_id, statut, motif').eq('employe_id', employeId).in('formation_id', ids),
  ])
  const possedees = new Set((ass ?? []).map(a => a.formation_id as string))
  const inscrits = new Set(ids.filter(id => versions.dejaDansFamille(id, possedees)))
  const demandes = new Map((dem ?? []).map(d => [d.formation_id as string, d]))
  return visibles.map(f => {
    const d = demandes.get(f.id as string)
    return {
      id: f.id, titre: f.titre, description: f.description, categorie: f.categorie, niveau: f.niveau,
      duree_estimee_minutes: f.duree_estimee_minutes, image_couverture: f.image_couverture,
      mode: f.acces_hors_assignation as 'libre' | 'demande', inscrit: inscrits.has(f.id as string),
      demande: (d?.statut as StatutDemande) ?? null, motif: (d?.motif as string) ?? null,
    }
  })
}

/** Peut traiter les demandes d'accès : admin qui gère la clinique de la formation, ou responsable de la formation. */
export function peutTraiterDemandes(a: Acteur | null, f: { clinique: string | null; responsable_id?: string | null }): boolean {
  if (!a) return false
  if (f.responsable_id && f.responsable_id === a.id && responsableAdmissible(a, f.clinique)) return true
  return (a.role === 'super_admin' || a.role === 'admin') && peutGererContenu(a, f.clinique)
}

/** Demandes d'accès d'une formation et de ses autres versions (FR / EN), les plus récentes d'abord. */
export async function demandesDeFormation(sb: SupabaseClient, formationId: string): Promise<DemandeAcces[]> {
  const versions = await chargerVersions(sb, [formationId])
  const { data, error } = await sb.from('demandes_acces_formation')
    .select('id, formation_id, employe_id, statut, message, demandee_le, traitee_le, motif, traitee_par')
    .in('formation_id', versions.famille(formationId)).order('demandee_le', { ascending: false })
  if (error || !data?.length) return []
  const ids = Array.from(new Set(data.flatMap(d => [d.employe_id, d.traitee_par]).filter(Boolean) as string[]))
  const { data: emps } = await sb.from('employes').select('id, prenom, nom, poste').in('id', ids)
  const par = new Map((emps ?? []).map(e => [e.id as string, e]))
  const nom = (i: string | null) => { const e = i ? par.get(i) : null; return e ? `${e.prenom ?? ''} ${e.nom ?? ''}`.trim() : '' }
  return data.map(d => ({
    id: d.id, employe_id: d.employe_id, statut: d.statut as StatutDemande, message: d.message, demandee_le: d.demandee_le,
    traitee_le: d.traitee_le, motif: d.motif, nom: nom(d.employe_id) || '—', poste: (par.get(d.employe_id)?.poste as string) ?? null,
    traitee_par_nom: nom(d.traitee_par) || null,
    formation_id: d.formation_id as string, langue: versions.langue(d.formation_id as string),
  }))
}

export type DemandeEnAttente = { id: string; formation_id: string; racine_id: string; titre: string; nom: string; demandee_le: string; langue: 'fr' | 'en' }

/**
 * Demandes d'accès en attente que l'acteur peut traiter (toutes formations, toutes versions),
 * les plus anciennes d'abord. [] tant que la migration n'est pas exécutée.
 */
export async function demandesEnAttente(sb: SupabaseClient, a: Acteur | null): Promise<DemandeEnAttente[]> {
  if (!a) return []
  const { data, error } = await sb.from('demandes_acces_formation')
    .select('id, formation_id, employe_id, demandee_le').eq('statut', 'en_attente').order('demandee_le')
  if (error || !data?.length) return []
  const fIds = Array.from(new Set(data.map(d => d.formation_id as string)))
  const versions = await chargerVersions(sb, fIds)
  const racines = Array.from(new Set(fIds.map(id => versions.racine(id))))
  const [{ data: fs }, { data: emps }] = await Promise.all([
    sb.from('formations').select('id, titre, clinique, responsable_id').in('id', Array.from(new Set([...fIds, ...racines]))),
    sb.from('employes').select('id, prenom, nom, clinique').in('id', Array.from(new Set(data.map(d => d.employe_id as string)))),
  ])
  const parF = new Map((fs ?? []).map(f => [f.id as string, f]))
  const parE = new Map((emps ?? []).map(e => [e.id as string, `${e.prenom ?? ''} ${e.nom ?? ''}`.trim()]))
  // Espace affiché (CMC ou WSSC) : seulement les formations de cet espace, demandées par ses employés
  const visibles = cliniquesContenuVisibles(a) as string[]
  const cliniqueEmp = new Map((emps ?? []).map(e => [e.id as string, e.clinique as string | null]))
  const dansLEspace = (fr: { clinique?: unknown }, empId: string) =>
    visibles.includes(String(fr.clinique ?? 'LES_DEUX')) && (!a.vue || cliniquesDe(cliniqueEmp.get(empId) ?? null).includes(a.vue))
  return data.flatMap(d => {
    const fid = d.formation_id as string
    const f = parF.get(fid); const racine = versions.racine(fid); const fr = parF.get(racine) ?? f
    if (!f || !fr || !(peutTraiterDemandes(a, f) || peutTraiterDemandes(a, fr)) || !dansLEspace(fr, d.employe_id as string)) return []
    return [{ id: d.id as string, formation_id: fid, racine_id: racine, titre: fr.titre as string, nom: parE.get(d.employe_id as string) || '—', demandee_le: d.demandee_le as string, langue: versions.langue(fid) }]
  })
}

/** Crée l'assignation volontaire (hors obligation), si elle n'existe pas déjà. */
export async function inscrireVolontaire(sb: SupabaseClient, employeId: string, formationId: string, par: string): Promise<string | null> {
  const versions = await chargerVersions(sb, [formationId])
  const { data: deja } = await sb.from('assignations').select('formation_id').eq('employe_id', employeId).in('formation_id', versions.famille(formationId)).limit(1)
  if (deja?.length) return null
  const ligne = { employe_id: employeId, formation_id: formationId, assigne_par: par, date_assignation: new Date().toISOString(), volontaire: true }
  let { error } = await sb.from('assignations').insert(ligne)
  if (error && /volontaire/.test(error.message)) {
    const { volontaire: _v, ...sans } = ligne; void _v
    ;({ error } = await sb.from('assignations').insert(sans))
  }
  return error ? error.message : null
}

// ── Rapport : intérêt pour les formations disponibles ─────────────────────────
export type LigneInteret = {
  formation_id: string; titre: string; clinique: string | null; mode: 'libre' | 'demande'
  inscrits: number; termines: number; en_attente: number; acceptees: number; refusees: number
  departements: { nom: string; n: number }[]
}

/**
 * Pour chaque formation disponible (sans obligation ou sur demande) visible par l'acteur :
 * inscriptions volontaires, formations terminées par ces volontaires, demandes par statut,
 * et départements d'où viennent l'intérêt (inscriptions + demandes). Limité aux employés de la portée.
 */
export async function rapportInteret(sb: SupabaseClient, formations: { id: string; titre: string; clinique: string | null }[], portee: string[] | null): Promise<LigneInteret[]> {
  if (!formations.length) return []
  const { data: fs } = await sb.from('formations').select('id, acces_hors_assignation').in('id', formations.map(f => f.id))
  const modes = new Map((fs ?? []).filter(f => f.acces_hors_assignation === 'libre' || f.acces_hors_assignation === 'demande').map(f => [f.id as string, f.acces_hors_assignation as 'libre' | 'demande']))
  const ids = [...modes.keys()]
  if (!ids.length) return []
  const dans = (id: string) => !portee || portee.includes(id)
  const [{ data: ass }, { data: dem }, { data: certs }] = await Promise.all([
    sb.from('assignations').select('*').in('formation_id', ids).eq('volontaire', true),
    sb.from('demandes_acces_formation').select('formation_id, employe_id, statut').in('formation_id', ids),
    sb.from('certificats').select('formation_id, employe_id').in('formation_id', ids).eq('valide', true),
  ])
  const assV = (ass ?? []).filter(a => dans(a.employe_id as string))
  const demV = (dem ?? []).filter(d => dans(d.employe_id as string))
  const empIds = Array.from(new Set([...assV.map(a => a.employe_id as string), ...demV.map(d => d.employe_id as string)]))
  const { data: emps } = empIds.length ? await sb.from('employes').select('id, departements(nom)').in('id', empIds) : { data: [] as { id: string; departements: unknown }[] }
  const dep = new Map((emps ?? []).map(e => {
    const d = Array.isArray(e.departements) ? e.departements[0] : e.departements
    return [e.id as string, ((d as { nom?: string } | null)?.nom) || 'Sans département']
  }))
  const certifies = new Set((certs ?? []).map(c => `${c.formation_id}:${c.employe_id}`))
  return formations.filter(f => modes.has(f.id)).map(f => {
    const a = assV.filter(x => x.formation_id === f.id)
    const d = demV.filter(x => x.formation_id === f.id)
    const interesses = new Set([...a.map(x => x.employe_id as string), ...d.map(x => x.employe_id as string)])
    const parDep = new Map<string, number>()
    interesses.forEach(id => { const n = dep.get(id) ?? 'Sans département'; parDep.set(n, (parDep.get(n) ?? 0) + 1) })
    return {
      formation_id: f.id, titre: f.titre, clinique: f.clinique, mode: modes.get(f.id)!,
      inscrits: a.length,
      termines: a.filter(x => certifies.has(`${f.id}:${x.employe_id}`)).length,
      en_attente: d.filter(x => x.statut === 'en_attente').length,
      acceptees: d.filter(x => x.statut === 'acceptee').length,
      refusees: d.filter(x => x.statut === 'refusee').length,
      departements: [...parDep].map(([nom, n]) => ({ nom, n })).sort((x, y) => y.n - x.n),
    }
  }).sort((x, y) => (y.inscrits + y.en_attente) - (x.inscrits + x.en_attente) || x.titre.localeCompare(y.titre, 'fr'))
}
