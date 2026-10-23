// Badges de l'employé, calculés à partir de son dossier (jamais stockés : toujours à jour).
//   - Parcours : une journée de formation terminée (formations complétées + politiques confirmées)
//   - Paliers : 1, 5, 10 et 25 formations terminées
//   - Excellence : 100 % à un questionnaire du premier coup ; toutes ses politiques confirmées
//   - Conformité à jour : aucune formation en retard ni certificat expiré
import type { SupabaseClient } from '@supabase/supabase-js'
import { chargerEtatsFormations, estComplete } from '@/lib/etat-formations'
import { avancementJournees } from '@/lib/journees'
import { politiquesDeLEmploye } from '@/lib/politiques'
import { joursRestants } from '@/lib/expirations'
import { cliniquesDe } from '@/lib/cliniques'

export type Famille = 'parcours' | 'palier' | 'excellence' | 'conformite' | 'participation' | 'perso'
export type Badge = {
  id: string
  famille: Famille
  icone: string
  titre: string
  /** Paramètres du titre (traduction) */
  vars?: Record<string, string | number>
  description: string
  obtenu: boolean
  le?: string | null
  progression?: { fait: number; total: number }
  lien?: string
}

export const PALIERS: { n: number; icone: string; titre: string }[] = [
  { n: 1, icone: '🌱', titre: 'Premier pas' },
  { n: 5, icone: '🚀', titre: 'Bien lancé' },
  { n: 10, icone: '⭐', titre: 'Assidu' },
  { n: 25, icone: '🏆', titre: 'Expert' },
]

/** Badges de palier pour un nombre de formations terminées (fonction pure, testée) */
export function badgesPaliers(terminees: number, seuils: number[] = PALIERS.map(p => p.n)): Badge[] {
  return seuils.map((n, i) => {
    const p = PALIERS[Math.min(i, PALIERS.length - 1)]
    return {
      id: 'palier:' + n, famille: 'palier' as const, icone: p.icone, titre: i < PALIERS.length ? p.titre : 'Palier {n}', vars: { n },
      description: n === 1 ? 'Terminer une première formation' : 'Terminer {n} formations',
      obtenu: terminees >= n, progression: { fait: Math.min(terminees, n), total: n },
    }
  })
}

// ---------------------------------------------------------------------------
// Réglages modifiables par l'administration (table badges_reglages) et badges créés par les cliniques (badges_perso)

export type ReglageBadge = { actif: boolean; icone?: string | null; titre?: string | null; description?: string | null; seuils?: number[] | null }
export type BadgePerso = { id: string; nom: string; description: string | null; icone: string; clinique: string; formation_ids: string[]; actif: boolean }
export type ConfigBadges = { reglages: Record<string, ReglageBadge>; perso: BadgePerso[] }
export const CONFIG_VIDE: ConfigBadges = { reglages: {}, perso: [] }

/** Badges intégrés que l'administration peut régler (seuils : valeurs par défaut) */
export const BADGES_INTEGRES: { cle: string; icone: string; titre: string; description: string; seuils?: number[]; multiples?: boolean }[] = [
  { cle: 'journee', icone: '🏅', titre: 'Parcours terminés', description: 'Un badge par journée de formation terminée (icône choisie dans la journée)', multiples: true },
  { cle: 'palier', icone: '🌱', titre: 'Paliers de formations terminées', description: 'Nombre de formations terminées', seuils: [1, 5, 10, 25], multiples: true },
  { cle: 'sans_faute', icone: '🎯', titre: 'Sans faute', description: '100 % à un questionnaire dès le premier essai' },
  { cle: 'politiques', icone: '📜', titre: 'Politiques à jour', description: 'Toutes vos politiques lues et confirmées' },
  { cle: 'conformite', icone: '🛡️', titre: 'Conformité à jour', description: 'Au moins {n} formations terminées, aucune en retard ni certificat expiré', seuils: [2] },
  { cle: 'sst', icone: '🦺', titre: 'SST formé', description: 'Toutes vos formations obligatoires LSST terminées' },
  { cle: 'infections', icone: '🧼', titre: 'Prévention des infections', description: 'Vos formations en prévention et contrôle des infections terminées' },
  { cle: 'confidentialite', icone: '🔐', titre: 'Gardien de la confidentialité', description: 'Formations sur la confidentialité (Loi 25) terminées et politiques confirmées' },
  { cle: 'toujours_certifie', icone: '♻️', titre: 'Toujours certifié', description: 'Un certificat renouvelé avant son expiration' },
  { cle: 'evenements', icone: '📅', titre: 'Événements en présentiel', description: 'Présences confirmées à des formations en présentiel', seuils: [1, 3, 10], multiples: true },
  { cle: 'voix', icone: '💬', titre: 'Voix de l’équipe', description: '{n} sondages de satisfaction remplis', seuils: [3] },
  { cle: 'externe', icone: '📎', titre: 'Formation externe', description: 'Une preuve de formation externe validée (congrès, cours…)' },
  { cle: 'regulier', icone: '🔥', titre: 'Régulier', description: 'Au moins une formation terminée {n} mois de suite', seuils: [3] },
]

/** Seuils en vigueur pour un badge intégré */
export function seuilsDe(config: ConfigBadges, cle: string): number[] {
  const r = config.reglages[cle]?.seuils
  const def = BADGES_INTEGRES.find(b => b.cle === cle)?.seuils ?? []
  const v = (r ?? def).filter(n => Number.isInteger(n) && n > 0)
  return v.length ? Array.from(new Set(v)).sort((a, b) => a - b) : def
}

/** Applique les réglages : badges désactivés retirés, icône / titre / description remplacés (fonction pure, testée) */
export function appliquerReglages(badges: Badge[], config: ConfigBadges): Badge[] {
  return badges.flatMap(b => {
    const cle = b.id.split(':')[0]
    const r = config.reglages[cle]
    if (!r) return [b]
    if (r.actif === false) return []
    const multiple = BADGES_INTEGRES.find(x => x.cle === cle)?.multiples
    if (multiple) return [b] // badges à plusieurs niveaux : seuls l'activation et les seuils se règlent
    return [{ ...b, icone: r.icone || b.icone, titre: r.titre || b.titre, description: r.description || b.description }]
  })
}

/** Réglages et badges des cliniques (tables absentes : valeurs par défaut) */
export async function chargerConfigBadges(sb: SupabaseClient): Promise<ConfigBadges> {
  const [{ data: reg, error: e1 }, { data: perso, error: e2 }] = await Promise.all([
    sb.from('badges_reglages').select('*'),
    sb.from('badges_perso').select('*').order('nom'),
  ])
  return {
    reglages: e1 ? {} : Object.fromEntries((reg ?? []).map(r => [r.cle as string, r as ReglageBadge])),
    perso: e2 ? [] : (perso ?? []) as BadgePerso[],
  }
}

/** Plus longue suite de mois consécutifs contenant au moins une date (fonction pure, testée) */
export function moisConsecutifs(dates: string[]): number {
  const mois = Array.from(new Set(dates.map(d => { const x = new Date(d); return x.getUTCFullYear() * 12 + x.getUTCMonth() }))).sort((a, b) => a - b)
  let meilleur = 0, courant = 0
  for (let i = 0; i < mois.length; i++) {
    courant = i > 0 && mois[i] === mois[i - 1] + 1 ? courant + 1 : 1
    meilleur = Math.max(meilleur, courant)
  }
  return meilleur
}

/** Thèmes reconnus d'après la catégorie ou le titre de la formation / politique */
export const THEMES = {
  infections: /infection|pci\b|hygi[eè]ne|st[ée]rilis|asepsie/i,
  confidentialite: /confidentialit|renseignements personnels|loi\s*25|vie priv[ée]e|\bprp\b/i,
}

/** Badge d'un thème : au moins une formation terminée, aucune en attente (fonction pure, testée) */
export function badgeTheme(formations: { complete: boolean }[], politiques: { confirmee: boolean }[] = []) {
  const faites = formations.filter(f => f.complete).length + politiques.filter(p => p.confirmee).length
  const total = formations.length + politiques.length
  return { obtenu: formations.some(f => f.complete) && faites === total, progression: total ? { fait: faites, total } : undefined }
}

type EmployeBadges = { id: string; clinique: string | null; role?: string | null; departement_id: string | null; poste?: string | null }

export async function badgesEmploye(sb: SupabaseClient, e: EmployeBadges, configFournie?: ConfigBadges): Promise<Badge[]> {
  const config = configFournie ?? await chargerConfigBadges(sb)
  const badges: Badge[] = []

  // Formations suivies (assignées, commencées ou certifiées)
  const [{ data: assignations }, { data: progs }, { data: certs }] = await Promise.all([
    sb.from('assignations').select('formation_id, date_echeance').eq('employe_id', e.id),
    sb.from('progressions').select('formation_id').eq('employe_id', e.id),
    sb.from('certificats').select('formation_id').eq('employe_id', e.id),
  ])
  const formationIds = Array.from(new Set([...(assignations ?? []), ...(progs ?? []), ...(certs ?? [])].map(x => x.formation_id as string)))
  const etat = await chargerEtatsFormations(sb, [e.id], formationIds)
  const terminees = formationIds.filter(f => estComplete(etat(e.id, f).statut)).length

  // 1. Parcours (journées de formation lancées pour l'employé)
  const { data: journees } = await sb.from('journees_formation').select('*').eq('modele', false).contains('employe_ids', [e.id]).order('cree_le')
  if (journees?.length) {
    const av = await avancementJournees(sb, journees as never)
    for (const j of journees as { id: string; nom: string; badge_icone?: string | null; employe_ids: string[] }[]) {
      const s = av[j.id]?.find(x => x.employe_id === e.id)
      if (!s || s.total === 0) continue
      badges.push({
        id: 'journee:' + j.id, famille: 'parcours', icone: j.badge_icone || '🏅', titre: 'Parcours « {nom} »', vars: { nom: j.nom },
        description: 'Toutes les formations et politiques du parcours', obtenu: s.faits >= s.total,
        progression: { fait: s.faits, total: s.total }, lien: '/dashboard/journees/' + j.id,
      })
    }
  }

  // 2. Paliers
  badges.push(...badgesPaliers(terminees, seuilsDe(config, 'palier')))

  // 3. Excellence
  const { data: tentatives } = await sb.from('tentatives_questionnaire').select('note_obtenue, note_maximale, reussi, numero_tentative, date_fin')
    .eq('employe_id', e.id).eq('reussi', true).eq('numero_tentative', 1).order('date_fin')
  const parfaite = (tentatives ?? []).find(t => Number(t.note_maximale) > 0 && Number(t.note_obtenue) >= Number(t.note_maximale))
  badges.push({
    id: 'sans_faute', famille: 'excellence', icone: '🎯', titre: 'Sans faute',
    description: '100 % à un questionnaire dès le premier essai', obtenu: !!parfaite, le: (parfaite?.date_fin as string | null) ?? null,
  })
  let politiques: { confirme_le: string | null }[] = []
  try { politiques = await politiquesDeLEmploye(sb, e) } catch { /* table absente */ }
  const confirmees = politiques.filter(p => p.confirme_le).length
  badges.push({
    id: 'politiques', famille: 'excellence', icone: '📜', titre: 'Politiques à jour',
    description: 'Toutes vos politiques lues et confirmées', obtenu: politiques.length > 0 && confirmees === politiques.length,
    progression: politiques.length ? { fait: confirmees, total: politiques.length } : undefined,
  })

  // 4. Conformité à jour
  const minConformite = seuilsDe(config, 'conformite')[0] ?? 2
  const enRetard = (assignations ?? []).filter(a => a.date_echeance && !estComplete(etat(e.id, a.formation_id as string).statut) && joursRestants(a.date_echeance as string) < 0).length
  const expires = formationIds.filter(f => { const s = etat(e.id, f); return !!s.certificat && !s.certificat_valide }).length
  badges.push({
    id: 'conformite', famille: 'conformite', icone: '🛡️', titre: 'Conformité à jour',
    description: 'Au moins {n} formations terminées, aucune en retard ni certificat expiré', vars: { n: minConformite },
    // Pas dès le départ : un minimum de formations terminées (2 par défaut)
    obtenu: terminees >= minConformite && enRetard === 0 && expires === 0,
    progression: terminees < minConformite ? { fait: terminees, total: minConformite } : undefined,
  })

  // 5. Santé, sécurité et confidentialité
  const { data: infos } = formationIds.length ? await sb.from('formations').select('id, titre, categorie, obligatoire').in('id', formationIds) : { data: [] }
  const suivies = (infos ?? []).map(f => ({ ...f, complete: estComplete(etat(e.id, f.id as string).statut), texte: `${f.categorie ?? ''} ${f.titre ?? ''}` }))
  const sst = badgeTheme(suivies.filter(f => f.obligatoire === true))
  badges.push({ id: 'sst', famille: 'conformite', icone: '🦺', titre: 'SST formé', description: 'Toutes vos formations obligatoires LSST terminées', ...sst })
  const pci = badgeTheme(suivies.filter(f => THEMES.infections.test(f.texte)))
  badges.push({ id: 'infections', famille: 'conformite', icone: '🧼', titre: 'Prévention des infections', description: 'Vos formations en prévention et contrôle des infections terminées', ...pci })
  const polsConf = (politiques as { titre?: string; confirme_le: string | null }[]).filter(p => THEMES.confidentialite.test(p.titre ?? ''))
  const conf = badgeTheme(suivies.filter(f => THEMES.confidentialite.test(f.texte)), polsConf.map(p => ({ confirmee: !!p.confirme_le })))
  badges.push({ id: 'confidentialite', famille: 'conformite', icone: '🔐', titre: 'Gardien de la confidentialité', description: 'Formations sur la confidentialité (Loi 25) terminées et politiques confirmées', ...conf })
  // Renouvelé : certificat obtenu au moins deux fois pour la même formation, et valide aujourd'hui
  const { data: emissions } = await sb.from('audit_logs').select('formation_id').in('type_action', ['CERTIFICAT_OBTENU', 'CERTIFICAT_EMIS_MANUELLEMENT'])
    .or(`acteur_id.eq.${e.id},cible_employe_id.eq.${e.id}`).not('formation_id', 'is', null)
  const parFormation = new Map<string, number>()
  for (const x of emissions ?? []) parFormation.set(x.formation_id as string, (parFormation.get(x.formation_id as string) ?? 0) + 1)
  const renouvele = Array.from(parFormation.entries()).some(([f, n]) => n >= 2 && etat(e.id, f).certificat_valide)
  badges.push({ id: 'toujours_certifie', famille: 'conformite', icone: '♻️', titre: 'Toujours certifié', description: 'Un certificat renouvelé avant son expiration', obtenu: renouvele })

  // 6. Participation
  const [{ data: presences }, sondages, { data: preuves }, { data: lecons }] = await Promise.all([
    sb.from('evenements_inscriptions').select('presence_le').eq('employe_id', e.id).eq('present', true),
    sb.from('sondage_reponses').select('created_at').eq('employe_id', e.id),
    sb.from('preuves_externes').select('valide_le').eq('employe_id', e.id).eq('statut', 'valide').order('valide_le'),
    sb.from('lesson_progressions').select('date_fin, lessons(modules(formation_id))').eq('employe_id', e.id).eq('statut', 'termine'),
  ])
  const nbPresences = (presences ?? []).length
  const NIVEAUX_EVT = [['📅', 'Présent à un événement'], ['🗓️', 'Habitué des événements'], ['🎪', 'Pilier des événements']] as const
  for (const [i, n] of seuilsDe(config, 'evenements').map((n, i) => [i, n] as const)) {
    const [icone, titre] = NIVEAUX_EVT[Math.min(i, NIVEAUX_EVT.length - 1)]
    badges.push({
      id: 'evenements:' + n, famille: 'participation', icone, titre, vars: { n },
      description: n === 1 ? 'Présence confirmée à une formation en présentiel' : 'Présence confirmée à {n} formations en présentiel',
      obtenu: nbPresences >= n, progression: { fait: Math.min(nbPresences, n), total: n },
    })
  }
  const nbSondages = (sondages.data ?? []).length
  const minVoix = seuilsDe(config, 'voix')[0] ?? 3
  badges.push({ id: 'voix', famille: 'participation', icone: '💬', titre: 'Voix de l’équipe', description: '{n} sondages de satisfaction remplis', vars: { n: minVoix }, obtenu: nbSondages >= minVoix, progression: { fait: Math.min(nbSondages, minVoix), total: minVoix } })
  badges.push({ id: 'externe', famille: 'participation', icone: '📎', titre: 'Formation externe', description: 'Une preuve de formation externe validée (congrès, cours…)', obtenu: (preuves ?? []).length > 0, le: (preuves?.[0]?.valide_le as string | null) ?? null })
  // Régulier : date de fin de chaque formation terminée (certificat, sinon dernière leçon terminée)
  const finParFormation = new Map<string, string>()
  for (const l of (lecons ?? []) as { date_fin: string | null; lessons: unknown }[]) {
    const le = l.lessons as { modules?: { formation_id?: string } | { formation_id?: string }[] } | null
    const m = Array.isArray(le?.modules) ? le?.modules[0] : le?.modules
    if (m?.formation_id && l.date_fin && (!finParFormation.has(m.formation_id) || finParFormation.get(m.formation_id)! < l.date_fin)) finParFormation.set(m.formation_id, l.date_fin)
  }
  const datesFin = formationIds.filter(f => estComplete(etat(e.id, f).statut))
    .map(f => etat(e.id, f).certificat?.date_emission ?? finParFormation.get(f)).filter((d): d is string => !!d)
  const suite = moisConsecutifs(datesFin)
  const minMois = seuilsDe(config, 'regulier')[0] ?? 3
  badges.push({ id: 'regulier', famille: 'participation', icone: '🔥', titre: 'Régulier', description: 'Au moins une formation terminée {n} mois de suite', vars: { n: minMois }, obtenu: suite >= minMois, progression: { fait: Math.min(suite, minMois), total: minMois } })

  // 7. Badges créés par les cliniques : terminer toutes les formations choisies
  const mesCliniques = cliniquesDe(e.clinique ?? 'LES_DEUX')
  const persoActifs = config.perso.filter(p => p.actif && (p.clinique === 'LES_DEUX' || mesCliniques.includes(p.clinique as never)) && p.formation_ids.length)
  if (persoActifs.length) {
    const ids = Array.from(new Set(persoActifs.flatMap(p => p.formation_ids)))
    const etatPerso = await chargerEtatsFormations(sb, [e.id], ids)
    for (const p of persoActifs) {
      const faites = p.formation_ids.filter(f => estComplete(etatPerso(e.id, f).statut)).length
      badges.push({ id: 'perso:' + p.id, famille: 'perso', icone: p.icone || '⭐', titre: p.nom, description: p.description || 'Terminer les formations du badge', obtenu: faites === p.formation_ids.length, progression: { fait: faites, total: p.formation_ids.length } })
    }
  }

  return appliquerReglages(badges, config)
}
