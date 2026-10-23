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

export type Famille = 'parcours' | 'palier' | 'excellence' | 'conformite' | 'participation'
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
export function badgesPaliers(terminees: number): Badge[] {
  return PALIERS.map(p => ({
    id: 'palier:' + p.n, famille: 'palier' as const, icone: p.icone, titre: p.titre,
    description: p.n === 1 ? 'Terminer une première formation' : `Terminer ${p.n} formations`,
    obtenu: terminees >= p.n, progression: { fait: Math.min(terminees, p.n), total: p.n },
  }))
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

export async function badgesEmploye(sb: SupabaseClient, e: EmployeBadges): Promise<Badge[]> {
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
  badges.push(...badgesPaliers(terminees))

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
  const enRetard = (assignations ?? []).filter(a => a.date_echeance && !estComplete(etat(e.id, a.formation_id as string).statut) && joursRestants(a.date_echeance as string) < 0).length
  const expires = formationIds.filter(f => { const s = etat(e.id, f); return !!s.certificat && !s.certificat_valide }).length
  badges.push({
    id: 'conformite', famille: 'conformite', icone: '🛡️', titre: 'Conformité à jour',
    description: 'Au moins 2 formations terminées, aucune en retard ni certificat expiré',
    // Pas dès le départ : au moins deux formations terminées
    obtenu: terminees >= 2 && enRetard === 0 && expires === 0,
    progression: terminees < 2 ? { fait: terminees, total: 2 } : undefined,
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
  for (const [n, icone, titre] of [[1, '📅', 'Présent à un événement'], [3, '🗓️', 'Habitué des événements'], [10, '🎪', 'Pilier des événements']] as const) {
    badges.push({
      id: 'evenements:' + n, famille: 'participation', icone, titre,
      description: n === 1 ? 'Présence confirmée à une formation en présentiel' : `Présence confirmée à ${n} formations en présentiel`,
      obtenu: nbPresences >= n, progression: { fait: Math.min(nbPresences, n), total: n },
    })
  }
  const nbSondages = (sondages.data ?? []).length
  badges.push({ id: 'voix', famille: 'participation', icone: '💬', titre: 'Voix de l’équipe', description: '3 sondages de satisfaction remplis', obtenu: nbSondages >= 3, progression: { fait: Math.min(nbSondages, 3), total: 3 } })
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
  badges.push({ id: 'regulier', famille: 'participation', icone: '🔥', titre: 'Régulier', description: 'Au moins une formation terminée 3 mois de suite', obtenu: suite >= 3, progression: { fait: Math.min(suite, 3), total: 3 } })

  return badges
}
