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

export type Famille = 'parcours' | 'palier' | 'excellence' | 'conformite'
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
    description: 'Aucune formation en retard ni certificat expiré',
    obtenu: (assignations ?? []).length > 0 && enRetard === 0 && expires === 0,
  })

  return badges
}
