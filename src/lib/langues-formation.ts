// Versions linguistiques d'une formation (français / anglais).
// Une version anglaise est une formation à part (langue = 'en') reliée à la française par version_de.
// Chaque employé a une « langue de formation » (employes.langue_formation) : à l'assignation, il reçoit
// la version de sa langue ; pour la conformité, les prérequis et les statistiques, terminer l'une ou
// l'autre version compte. Tant que la migration langues_formation.sql n'est pas exécutée, tout se
// comporte comme avant (chaque formation est seule, tout le monde est en français).
import type { SupabaseClient } from '@supabase/supabase-js'

export type LangueFormation = 'fr' | 'en'
export const LANGUES_FORMATION: LangueFormation[] = ['fr', 'en']
export const LIBELLE_LANGUE: Record<LangueFormation, string> = { fr: 'Français', en: 'English' }

export function lireLangue(v: unknown): LangueFormation {
  return v === 'en' ? 'en' : 'fr'
}

export type FormationVersion = { id: string; langue?: string | null; version_de?: string | null; publiee?: boolean | null }

/** Familles de versions : identifiant de la version française (racine) → versions connues. Fonction pure. */
export class Versions {
  private racineDe = new Map<string, string>()
  private parRacine = new Map<string, FormationVersion[]>()

  constructor(lignes: FormationVersion[]) {
    for (const f of lignes) {
      const r = f.version_de || f.id
      this.racineDe.set(f.id, r)
      const l = this.parRacine.get(r) ?? []
      if (!l.some(x => x.id === f.id)) l.push(f)
      this.parRacine.set(r, l)
    }
  }

  /** Version française (racine) d'une formation. */
  racine(id: string): string { return this.racineDe.get(id) ?? id }

  /** Toutes les versions d'une formation (elle comprise). */
  famille(id: string): string[] {
    const l = this.parRacine.get(this.racine(id))
    return l?.length ? l.map(f => f.id) : [id]
  }

  /** Langue d'une version. */
  langue(id: string): LangueFormation {
    const f = (this.parRacine.get(this.racine(id)) ?? []).find(x => x.id === id)
    return lireLangue(f?.langue)
  }

  /** Version anglaise reliée, s'il y en a une. */
  versionAnglaise(id: string): FormationVersion | null {
    return (this.parRacine.get(this.racine(id)) ?? []).find(f => f.id !== this.racine(id) && lireLangue(f.langue) === 'en') ?? null
  }

  /**
   * Version à donner à un employé de cette langue : la version de sa langue si elle est publiée,
   * sinon la formation demandée (on n'envoie jamais quelqu'un vers une version non publiée).
   */
  versionPour(id: string, langue: LangueFormation): string {
    const versions = this.parRacine.get(this.racine(id)) ?? []
    const voulue = versions.find(f => lireLangue(f.langue) === langue && f.publiee !== false)
    return voulue?.id ?? id
  }

  /** L'employé a-t-il déjà une version de cette formation parmi ces identifiants ? */
  dejaDansFamille(id: string, possedees: Set<string>): string | null {
    return this.famille(id).find(x => possedees.has(x)) ?? null
  }
}

function colonneAbsente(e: { code?: string; message?: string } | null): boolean {
  return !!e && (e.code === '42703' || e.code === 'PGRST204' || /langue|version_de/.test(e.message ?? ''))
}

/** Charge les familles des formations données (et de leurs autres versions). */
export async function chargerVersions(sb: SupabaseClient, ids: string[]): Promise<Versions> {
  const uniques = Array.from(new Set(ids.filter(Boolean)))
  if (!uniques.length) return new Versions([])
  const champs = 'id, langue, version_de, publiee'
  const { data, error } = await sb.from('formations').select(champs).in('id', uniques)
  if (error) return new Versions(uniques.map(id => ({ id })))
  const lignes = (data ?? []) as FormationVersion[]
  // Toutes les versions reliées (peu nombreuses), puis les versions françaises qui manquent
  const { data: liees } = await sb.from('formations').select(champs).not('version_de', 'is', null)
  const reliees = ((liees ?? []) as FormationVersion[]).filter(f => {
    const r = f.version_de as string
    return lignes.some(x => x.id === r || x.id === f.id || x.version_de === r)
  })
  const connues = new Set([...lignes, ...reliees].map(f => f.id))
  const manquantes = Array.from(new Set(reliees.map(f => f.version_de as string))).filter(r => !connues.has(r))
  const { data: racines } = manquantes.length ? await sb.from('formations').select(champs).in('id', manquantes) : { data: [] }
  return new Versions([...lignes, ...reliees, ...((racines ?? []) as FormationVersion[])])
}

/** Langue de formation de chaque employé (« fr » par défaut, ou si la migration n'est pas faite). */
export async function languesEmployes(sb: SupabaseClient, ids: string[]): Promise<Map<string, LangueFormation>> {
  const res = new Map<string, LangueFormation>()
  const uniques = Array.from(new Set(ids.filter(Boolean)))
  for (const id of uniques) res.set(id, 'fr')
  for (let i = 0; i < uniques.length; i += 300) {
    const { data, error } = await sb.from('employes').select('id, langue_formation').in('id', uniques.slice(i, i + 300))
    if (error) return res
    for (const e of data ?? []) res.set(e.id as string, lireLangue(e.langue_formation))
  }
  return res
}

/** Langue de formation d'un employé. */
export async function langueEmploye(sb: SupabaseClient, id: string): Promise<LangueFormation> {
  return (await languesEmployes(sb, [id])).get(id) ?? 'fr'
}

/**
 * Formations visibles par un employé dans un catalogue : on retire les versions d'une autre langue
 * quand la version de sa langue existe (et est publiée). Fonction pure.
 */
export function garderLaLangue<T extends { id: string }>(formations: T[], v: Versions, langue: LangueFormation): T[] {
  const presentes = new Set(formations.map(f => f.id))
  return formations.filter(f => {
    const voulue = v.versionPour(f.id, langue)
    return voulue === f.id || !presentes.has(voulue)
  })
}

/**
 * Change la langue de formation d'un employé et bascule ses assignations pas encore commencées
 * vers la version de la nouvelle langue. Les assignations commencées ou terminées ne bougent pas.
 */
export async function changerLangueEmploye(sb: SupabaseClient, employeId: string, langue: LangueFormation): Promise<{ erreur?: string; basculees: number }> {
  const { error } = await sb.from('employes').update({ langue_formation: langue }).eq('id', employeId)
  if (error) return { erreur: colonneAbsente(error) ? 'Exécutez d’abord supabase/migrations/langues_formation.sql dans Supabase.' : error.message, basculees: 0 }

  const { data: ass } = await sb.from('assignations').select('id, formation_id').eq('employe_id', employeId)
  const lignes = (ass ?? []) as { id: string; formation_id: string }[]
  if (!lignes.length) return { basculees: 0 }
  const v = await chargerVersions(sb, lignes.map(a => a.formation_id))
  const possedees = new Set(lignes.map(a => a.formation_id))
  const aBasculer = lignes
    .map(a => ({ a, cible: v.versionPour(a.formation_id, langue) }))
    .filter(x => x.cible !== x.a.formation_id && !possedees.has(x.cible))
  if (!aBasculer.length) return { basculees: 0 }

  // « Commencée » : progression, tentative de questionnaire ou certificat sur cette version
  const ids = aBasculer.map(x => x.a.formation_id)
  const [{ data: prog }, { data: tent }, { data: certs }] = await Promise.all([
    sb.from('progressions').select('formation_id').eq('employe_id', employeId).in('formation_id', ids),
    sb.from('tentatives_questionnaire').select('questionnaire_id, questionnaires(formation_id)').eq('employe_id', employeId),
    sb.from('certificats').select('formation_id').eq('employe_id', employeId).in('formation_id', ids),
  ])
  const commencees = new Set<string>([
    ...(prog ?? []).map(p => p.formation_id as string),
    ...(certs ?? []).map(c => c.formation_id as string),
    ...((tent ?? []) as { questionnaires?: { formation_id?: string } | { formation_id?: string }[] | null }[])
      .map(t => (Array.isArray(t.questionnaires) ? t.questionnaires[0] : t.questionnaires)?.formation_id)
      .filter((x): x is string => !!x),
  ])
  let basculees = 0
  for (const { a, cible } of aBasculer) {
    if (commencees.has(a.formation_id)) continue
    const { error: e } = await sb.from('assignations').update({ formation_id: cible }).eq('id', a.id)
    if (!e) basculees++
  }
  return { basculees }
}

/** Relie (ou délie, avec null) une version anglaise à une formation française. */
export async function lierVersionAnglaise(sb: SupabaseClient, francaiseId: string, anglaiseId: string | null): Promise<string | null> {
  // Délier l'ancienne version anglaise
  const { error: e1 } = await sb.from('formations').update({ version_de: null }).eq('version_de', francaiseId)
  if (e1) return colonneAbsente(e1) ? 'Exécutez d’abord supabase/migrations/langues_formation.sql dans Supabase.' : e1.message
  if (!anglaiseId) return null
  const { error: e2 } = await sb.from('formations').update({ version_de: francaiseId, langue: 'en' }).eq('id', anglaiseId)
  return e2 ? e2.message : null
}
