// Formulaires — accès aux données (serveur seulement, clé de service).
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Acteur } from '@/lib/permissions'
import { cliniquesDe } from '@/lib/cliniques'
import { courrielsActifs, envoyerCourriels, gabarit } from '@/lib/courriels'
import {
  type Formulaire, cliniquesFormulairePossibles, destinataireDe, nettoyerChamps, numeroReponse, peutVoirReponses,
} from '@/lib/formulaires'

/** Table absente (migration formulaires.sql pas encore exécutée) */
export const tableAbsente = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /formulaire/.test(e.message ?? '') && /exist|schema cache/.test(e.message ?? ''))
export const MIGRATION_FORMULAIRES = 'Le module Formulaires n’est pas encore activé : exécutez la migration supabase/migrations/formulaires.sql.'

export type Personne = { id: string; prenom: string | null; nom: string | null; email: string | null; role: string; clinique: string | null }

/** Administrateurs pouvant recevoir les réponses d'un formulaire de cette clinique. */
export async function destinatairesPossibles(sb: SupabaseClient, clinique: string): Promise<Personne[]> {
  const { data } = await sb.from('employes').select('id, prenom, nom, email, role, clinique, actif')
    .in('role', ['admin', 'super_admin']).or('actif.is.null,actif.eq.true').order('prenom')
  const besoin = cliniquesDe(clinique)
  return ((data ?? []) as (Personne & { actif?: boolean })[])
    .filter(p => p.role === 'super_admin' || besoin.every(c => cliniquesDe(p.clinique).includes(c)))
    .map(({ actif: _a, ...p }) => p)
}

/** Valide le contenu envoyé par l'éditeur (création ou modification). */
export async function validerFormulaire(sb: SupabaseClient, a: Acteur, b: Record<string, unknown>) {
  const titre = String(b.titre ?? '').trim().slice(0, 200)
  if (!titre) return { erreur: 'Le titre est obligatoire' }
  const clinique = String(b.clinique ?? '')
  if (!cliniquesFormulairePossibles(a).includes(clinique as Formulaire['clinique'])) return { erreur: 'Clinique non permise' }
  const nc = nettoyerChamps(b.champs)
  if ('erreur' in nc) return { erreur: nc.erreur }
  if (!nc.champs.some(c => c.type !== 'section' && c.type !== 'info')) return { erreur: 'Ajoutez au moins une question' }
  let destinataire_id: string | null = null
  if (b.destinataire_id) {
    const possibles = await destinatairesPossibles(sb, clinique)
    if (!possibles.some(p => p.id === b.destinataire_id)) return { erreur: 'Destinataire non valide pour cette clinique' }
    destinataire_id = String(b.destinataire_id)
  }
  const txt = (v: unknown, n: number) => { const s = String(v ?? '').trim().slice(0, n); return s || null }
  return {
    valeurs: {
      titre, clinique, champs: nc.champs, destinataire_id,
      code: txt(b.code, 60), description: txt(b.description, 1000), instructions: txt(b.instructions, 10000),
      actif: b.actif === true,
    },
  }
}

/** Formulaires dont la personne voit les réponses (créés par elle, reçus, ou tous pour l'admin global). */
export async function formulairesRecus(sb: SupabaseClient, a: Acteur): Promise<Formulaire[]> {
  let q = sb.from('formulaires').select('*').order('titre')
  if (a.role !== 'super_admin') q = q.or(`cree_par.eq.${a.id},destinataire_id.eq.${a.id}`)
  const { data, error } = await q
  if (error) return []
  return ((data ?? []) as Formulaire[]).filter(f => peutVoirReponses(a, f))
}

/** Nombre de réponses non traitées que la personne reçoit (pastille du menu). */
export async function nombreReponsesAPrendre(sb: SupabaseClient, a: Acteur): Promise<number> {
  if (a.role !== 'super_admin' && a.role !== 'admin') return 0
  const { data, error } = await sb.from('formulaires').select('id, cree_par, destinataire_id')
  if (error || !data?.length) return 0
  const ids = (data as Pick<Formulaire, 'id' | 'cree_par' | 'destinataire_id'>[]).filter(f => destinataireDe(f) === a.id).map(f => f.id)
  if (!ids.length) return 0
  const { count } = await sb.from('formulaire_reponses').select('id', { count: 'exact', head: true }).in('formulaire_id', ids).eq('statut', 'recu')
  return count ?? 0
}

/** Courriel à la personne qui reçoit : aucun contenu du formulaire (renseignements confidentiels), seulement un lien. */
export async function avertirReception(sb: SupabaseClient, f: Formulaire, reponse: { id: string; numero: number }, origine: string) {
  if (!courrielsActifs()) return
  const id = destinataireDe(f)
  if (!id) return
  const { data: d } = await sb.from('employes').select('prenom, email, clinique').eq('id', id).maybeSingle()
  if (!d?.email) return
  const { html, texte } = gabarit({
    origine, clinique: f.clinique === 'LES_DEUX' ? null : f.clinique,
    titre: 'Nouveau formulaire reçu',
    paragraphes: [
      `Bonjour ${d.prenom ?? ''},`.replace(' ,', ','),
      `Un formulaire « ${f.titre} » (${numeroReponse(reponse.numero)}) vient d’être envoyé. Vous en êtes le destinataire.`,
      'Pour des raisons de confidentialité, son contenu n’est visible que dans la plateforme.',
    ],
    bouton: { libelle: 'Ouvrir le formulaire', lien: `${origine}/admin/formulaires/reponses/${reponse.id}` },
  })
  await envoyerCourriels([{ a: d.email, sujet: `Nouveau formulaire reçu — ${f.titre} ${numeroReponse(reponse.numero)}`, html, texte }])
}
