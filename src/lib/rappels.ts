// Rappels automatiques par courriel (exécutés chaque jour par /api/cron/rappels).
// Chaque rappel n'est envoyé qu'une fois : il est inscrit dans la table rappels_envoyes
// (supabase/migrations/conformite_suivi.sql). Sans cette table, aucun rappel n'est envoyé.
import type { SupabaseClient } from '@supabase/supabase-js'
import { envoyerCourriels, gabarit, courrielsActifs, type Courriel } from '@/lib/courriels'
import { joursRestants, palierRappelCertificat } from '@/lib/expirations'

export type TypeRappel = 'certificat_expiration' | 'formation_echeance'

export type BilanRappels = {
  type: TypeRappel
  candidats: number
  envoyes: number
  ignores: number
  erreur?: string
}

type Envoi = { courriel: Courriel; reference: string; palier: string; employe_id: string }

/** La table de suivi existe-t-elle ? (migration exécutée) */
export async function suiviRappelsDisponible(sb: SupabaseClient): Promise<boolean> {
  const { error } = await sb.from('rappels_envoyes').select('id', { head: true, count: 'exact' }).limit(1)
  return !error
}

async function dejaEnvoyes(sb: SupabaseClient, type: TypeRappel, references: string[]): Promise<Set<string>> {
  const deja = new Set<string>()
  for (let i = 0; i < references.length; i += 200) {
    const { data } = await sb.from('rappels_envoyes').select('reference, palier')
      .eq('type', type).in('reference', references.slice(i, i + 200))
    for (const r of data ?? []) deja.add(`${r.reference}|${r.palier}`)
  }
  return deja
}

/** Envoie les rappels pas encore envoyés, puis les inscrit dans rappels_envoyes. */
async function envoyerEtInscrire(sb: SupabaseClient, type: TypeRappel, envois: Envoi[]): Promise<BilanRappels> {
  const bilan: BilanRappels = { type, candidats: envois.length, envoyes: 0, ignores: 0 }
  if (envois.length === 0) return bilan
  const deja = await dejaEnvoyes(sb, type, Array.from(new Set(envois.map(e => e.reference))))
  const aEnvoyer = envois.filter(e => !deja.has(`${e.reference}|${e.palier}`))
  bilan.ignores = envois.length - aEnvoyer.length
  if (aEnvoyer.length === 0) return bilan

  const r = await envoyerCourriels(aEnvoyer.map(e => e.courriel))
  // On n'inscrit que ce qui est réellement parti (les lots sont envoyés dans l'ordre)
  const partis = aEnvoyer.slice(0, r.envoyes)
  if (partis.length) {
    await sb.from('rappels_envoyes').insert(partis.map(e => ({
      type, reference: e.reference, palier: e.palier, employe_id: e.employe_id, destinataire: e.courriel.a,
    })))
  }
  bilan.envoyes = partis.length
  if (r.erreur) bilan.erreur = r.erreur
  return bilan
}

const dateLongue = (iso: string) =>
  new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('fr-CA', { dateStyle: 'long' })

type EmployeRappel = { id: string; prenom: string | null; email: string | null; clinique: string | null; actif: boolean | null }

async function employesActifs(sb: SupabaseClient, ids: string[]): Promise<Map<string, EmployeRappel>> {
  const carte = new Map<string, EmployeRappel>()
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await sb.from('employes').select('id, prenom, email, clinique, actif').in('id', ids.slice(i, i + 200))
    for (const e of (data ?? []) as EmployeRappel[]) if (e.actif !== false && e.email) carte.set(e.id, e)
  }
  return carte
}

// ---------------------------------------------------------------------------
// Certificats qui expirent

export async function rappelsCertificats(sb: SupabaseClient, origine: string, aujourdhui = new Date()): Promise<BilanRappels> {
  const { data: certs } = await sb.from('certificats')
    .select('id, employe_id, formation_id, date_expiration, valide')
    .not('date_expiration', 'is', null)
  const candidats = (certs ?? [])
    .filter(c => c.valide !== false)
    .map(c => ({ ...c, jours: joursRestants(c.date_expiration as string, aujourdhui) }))
    .map(c => ({ ...c, palier: palierRappelCertificat(c.jours) }))
    .filter(c => c.palier !== null)
  if (candidats.length === 0) return { type: 'certificat_expiration', candidats: 0, envoyes: 0, ignores: 0 }

  const employes = await employesActifs(sb, Array.from(new Set(candidats.map(c => c.employe_id as string))))
  const { data: formations } = await sb.from('formations').select('id, titre')
    .in('id', Array.from(new Set(candidats.map(c => c.formation_id as string))))
  const titre = new Map((formations ?? []).map(f => [f.id as string, f.titre as string]))

  const envois: Envoi[] = []
  for (const c of candidats) {
    const e = employes.get(c.employe_id as string)
    if (!e) continue
    const nomFormation = titre.get(c.formation_id as string) ?? 'votre formation'
    const quand = dateLongue(c.date_expiration as string)
    const expire = c.jours <= 0
    const { html, texte } = gabarit({
      origine, clinique: e.clinique,
      titre: expire ? 'Votre certificat a expiré' : 'Votre certificat expire bientôt',
      paragraphes: [
        `Bonjour ${e.prenom ?? ''},`.replace(' ,', ','),
        expire
          ? `Votre certificat pour la formation « ${nomFormation} » a expiré le ${quand}.`
          : `Votre certificat pour la formation « ${nomFormation} » expire le ${quand} (dans ${c.jours} jour${c.jours > 1 ? 's' : ''}).`,
        'Pour rester en règle, refaites la formation et son questionnaire afin d’obtenir un nouveau certificat.',
      ],
      bouton: { libelle: 'Refaire la formation', lien: `${origine}/formations/${c.formation_id}` },
    })
    envois.push({
      courriel: { a: e.email!, sujet: expire ? `Certificat expiré : ${nomFormation}` : `Certificat à renouveler : ${nomFormation}`, html, texte },
      // La date d'expiration fait partie de la référence : un renouvellement relance un nouveau cycle de rappels
      reference: `${c.id}:${c.date_expiration}`,
      palier: c.palier!,
      employe_id: e.id,
    })
  }
  return envoyerEtInscrire(sb, 'certificat_expiration', envois)
}

// ---------------------------------------------------------------------------

export async function executerRappels(sb: SupabaseClient, origine: string): Promise<{ actif: boolean; raison?: string; bilans: BilanRappels[] }> {
  if (!courrielsActifs()) return { actif: false, raison: 'Courriels non configurés (RESEND_API_KEY / COURRIEL_EXPEDITEUR)', bilans: [] }
  if (!(await suiviRappelsDisponible(sb))) return { actif: false, raison: 'Table rappels_envoyes absente : exécuter supabase/migrations/conformite_suivi.sql', bilans: [] }
  const bilans: BilanRappels[] = []
  bilans.push(await rappelsCertificats(sb, origine))
  return { actif: true, bilans }
}
