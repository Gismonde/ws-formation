// Rappels des journées de formation (ex. journées d'embauche) : un courriel par employé qui liste
// les politiques de sa journée qu'il n'a pas encore lues et confirmées.
// Paliers : 7 jours avant l'échéance, la veille, puis chaque semaine de retard (4 semaines au plus).
// Les formations de la journée ont déjà leurs propres rappels (échéance de l'assignation) : pas de doublon.
// Seulement les journées ouvertes. Comptes pas encore activés : rien (voir envoyerCourriels).
import type { SupabaseClient } from '@supabase/supabase-js'
import { gabarit } from '@/lib/courriels'
import { joursRestants } from '@/lib/expirations'
import { palierRelanceEcheance, estEnRetard } from '@/lib/echeances'
import { envoyerEtInscrire, employesActifs, dateLongue, type BilanRappels, type Envoi } from '@/lib/rappels'

type JourneeRappel = { id: string; nom: string; employe_ids: string[]; politique_ids: string[]; date_echeance: string }
type PolitiqueRappel = { id: string; titre: string; version: number; actif: boolean | null; brouillon: boolean | null }

/** Politiques de la journée encore à confirmer (version en vigueur), dans l'ordre de la journée. (Fonction pure, testée.) */
export function politiquesRestantes(ids: string[], politiques: Map<string, PolitiqueRappel>, confirmees: Set<string>): PolitiqueRappel[] {
  return ids.map(id => politiques.get(id)).filter((p): p is PolitiqueRappel => !!p && p.actif !== false && p.brouillon !== true)
    .filter(p => !confirmees.has(`${p.id}:${p.version}`))
}

export async function rappelsJournees(sb: SupabaseClient, origine: string, aujourdhui = new Date()): Promise<BilanRappels> {
  const vide: BilanRappels = { type: 'journee_echeance', candidats: 0, envoyes: 0, ignores: 0 }
  const { data, error } = await sb.from('journees_formation').select('id, nom, employe_ids, politique_ids, date_echeance')
    .eq('modele', false).not('ouverte_le', 'is', null).not('date_echeance', 'is', null)
  if (error) return { ...vide, erreur: error.message }
  const journees = ((data ?? []) as JourneeRappel[])
    .map(j => ({ ...j, jours: joursRestants(j.date_echeance, aujourdhui) }))
    .map(j => ({ ...j, palier: palierRelanceEcheance(j.jours) }))
    .filter(j => j.palier !== null && (j.politique_ids ?? []).length > 0 && (j.employe_ids ?? []).length > 0)
  if (journees.length === 0) return vide

  const employeIds = Array.from(new Set(journees.flatMap(j => j.employe_ids)))
  const politiqueIds = Array.from(new Set(journees.flatMap(j => j.politique_ids)))
  const [employes, { data: pols }, { data: confs }] = await Promise.all([
    employesActifs(sb, employeIds),
    sb.from('politiques').select('id, titre, version, actif, brouillon').in('id', politiqueIds),
    sb.from('politiques_confirmations').select('employe_id, politique_id, version').in('employe_id', employeIds).in('politique_id', politiqueIds),
  ])
  const politiques = new Map(((pols ?? []) as PolitiqueRappel[]).map(p => [p.id, p]))
  const confirmeesPar = new Map<string, Set<string>>()
  for (const c of confs ?? []) {
    const k = c.employe_id as string
    if (!confirmeesPar.has(k)) confirmeesPar.set(k, new Set())
    confirmeesPar.get(k)!.add(`${c.politique_id}:${c.version}`)
  }

  const envois: Envoi[] = []
  for (const j of journees) {
    const quand = dateLongue(j.date_echeance)
    const retard = estEnRetard(j.palier!)
    for (const id of j.employe_ids) {
      const e = employes.get(id)
      if (!e) continue
      const restantes = politiquesRestantes(j.politique_ids, politiques, confirmeesPar.get(id) ?? new Set())
      if (restantes.length === 0) continue // tout est confirmé : aucun rappel
      const n = restantes.length
      const m = gabarit({
        origine, clinique: e.clinique,
        titre: `Journée de formation — ${j.nom}`,
        paragraphes: [
          `Bonjour ${e.prenom ?? ''},`.replace(' ,', ','),
          retard
            ? `Votre journée de formation « ${j.nom} » devait être terminée le ${quand}. Il vous reste ${n} politique${n > 1 ? 's' : ''} à lire et à confirmer :`
            : `Petit rappel : votre journée de formation « ${j.nom} » est à terminer d’ici le ${quand}. Il vous reste ${n} politique${n > 1 ? 's' : ''} à lire et à confirmer :`,
          ...restantes.map(p => `• ${p.titre}`),
          'Ouvrez chaque politique, lisez-la, puis cliquez sur « Confirmer : J’ai lu et compris ».',
        ],
        bouton: { libelle: 'Voir mes politiques', lien: `${origine}/dashboard/politiques` },
      })
      envois.push({
        courriel: { a: e.email!, sujet: retard ? `Rappel : journée de formation « ${j.nom} » à terminer` : `Rappel : journée de formation « ${j.nom} » — échéance le ${quand}`, html: m.html, texte: m.texte },
        reference: `${j.id}:${id}:${j.date_echeance}`, palier: j.palier!, employe_id: id,
      })
    }
  }
  return envoyerEtInscrire(sb, 'journee_echeance', envois)
}
