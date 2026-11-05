// Formulaires — accès aux données (serveur seulement, clé de service).
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Acteur } from '@/lib/permissions'
import { cliniquesDe, aAccesAdmin } from '@/lib/cliniques'
import { courrielsActifs, envoyerCourriels, gabarit } from '@/lib/courriels'
import {
  type Formulaire, type Destinataire, CLINIQUE_FORMULAIRES, MESSAGE_ANONYMAT_DEFAUT, nettoyerChamps, numeroReponse, peutVoirReponses, STATUTS, type StatutReponse,
} from '@/lib/formulaires'

/** Table absente (migration formulaires.sql pas encore exécutée) */
export const tableAbsente = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /formulaire/.test(e.message ?? '') && /exist|schema cache/.test(e.message ?? ''))
export const MIGRATION_FORMULAIRES = 'Le module Formulaires n’est pas encore activé : exécutez la migration supabase/migrations/formulaires.sql.'

export type Personne = { id: string; prenom: string | null; nom: string | null; email: string | null; role: string; clinique: string | null; departement_id?: string | null }
export type Departement = { id: string; nom: string; gestionnaires: number }

/** Personnes du WSSC ayant un accès Admin : peuvent être désignées pour recevoir des formulaires. */
export async function destinatairesPossibles(sb: SupabaseClient): Promise<{ personnes: Personne[]; departements: Departement[] }> {
  const [{ data: emps }, { data: depts }] = await Promise.all([
    sb.from('employes').select('*').in('role', ['admin', 'super_admin', 'gestionnaire']).or('actif.is.null,actif.eq.true').order('prenom'),
    sb.from('departements').select('id, nom, clinique').order('nom'),
  ])
  const personnes = ((emps ?? []) as (Personne & Record<string, unknown>)[])
    .filter(p => p.role === 'super_admin' || (cliniquesDe(p.clinique).includes(CLINIQUE_FORMULAIRES) && aAccesAdmin(p as never)))
    .map(p => ({ id: p.id, prenom: p.prenom, nom: p.nom, email: p.email, role: p.role, clinique: p.clinique, departement_id: (p.departement_id as string | null) ?? null }))
  const departements = ((depts ?? []) as { id: string; nom: string; clinique: string | null }[])
    .filter(d => !d.clinique || cliniquesDe(d.clinique).includes(CLINIQUE_FORMULAIRES))
    .map(d => ({ id: d.id, nom: d.nom, gestionnaires: personnes.filter(p => p.role === 'gestionnaire' && p.departement_id === d.id).length }))
  return { personnes, departements }
}

/** Valide le contenu envoyé par l'éditeur (création ou modification). */
export async function validerFormulaire(sb: SupabaseClient, _a: Acteur, b: Record<string, unknown>) {
  const titre = String(b.titre ?? '').trim().slice(0, 200)
  if (!titre) return { erreur: 'Le titre est obligatoire' }
  const nc = nettoyerChamps(b.champs)
  if ('erreur' in nc) return { erreur: nc.erreur }
  if (!nc.champs.some(c => c.type !== 'section' && c.type !== 'info')) return { erreur: 'Ajoutez au moins une question' }
  // Destinataires : départements (leurs gestionnaires) et personnes ayant un accès Admin au WSSC
  const possibles = await destinatairesPossibles(sb)
  const brut = Array.isArray(b.destinataires) ? b.destinataires as Destinataire[] : []
  const destinataires: Destinataire[] = []
  for (const d of brut.slice(0, 30)) {
    const ok = d?.type === 'departement' ? possibles.departements.some(x => x.id === d.id) : d?.type === 'employe' && possibles.personnes.some(x => x.id === d.id)
    if (!ok) return { erreur: 'Destinataire non valide' }
    if (!destinataires.some(x => x.type === d.type && x.id === d.id)) destinataires.push({ type: d.type, id: String(d.id) })
  }
  const txt = (v: unknown, n: number) => { const s = String(v ?? '').trim().slice(0, n); return s || null }
  return {
    valeurs: {
      titre, clinique: CLINIQUE_FORMULAIRES, champs: nc.champs, destinataires, destinataire_id: null,
      code: txt(b.code, 60), description: txt(b.description, 1000), instructions: txt(b.instructions, 10000),
      anonyme_permis: b.anonyme_permis === true,
      message_anonymat: b.anonyme_permis === true ? (txt(b.message_anonymat, 2000) ?? MESSAGE_ANONYMAT_DEFAUT) : txt(b.message_anonymat, 2000),
      actif: b.actif === true,
      // Colonne ajoutée par formulaires_image.sql : écrite seulement si envoyée
      ...('image' in b ? { image: txt(b.image, 500) } : {}),
    },
  }
}

/** Formulaires dont la personne voit les réponses (tous pour les administrateurs du WSSC). */
export async function formulairesRecus(sb: SupabaseClient, a: Acteur): Promise<Formulaire[]> {
  const { data, error } = await sb.from('formulaires').select('*').order('titre')
  if (error) return []
  return ((data ?? []) as Formulaire[]).filter(f => peutVoirReponses(a, f))
}

/** Personnes (courriels) qui reçoivent un formulaire : destinataires désignés, sinon le créateur. */
async function courrielsDestinataires(sb: SupabaseClient, f: Formulaire): Promise<{ prenom: string | null; email: string }[]> {
  const l = f.destinataires ?? []
  const ids = l.filter(d => d.type === 'employe').map(d => d.id)
  const depts = l.filter(d => d.type === 'departement').map(d => d.id)
  if (!l.length) ids.push(...[f.destinataire_id ?? f.cree_par].filter(Boolean) as string[])
  const res: { prenom: string | null; email: string }[] = []
  if (ids.length) {
    const { data } = await sb.from('employes').select('prenom, email, actif').in('id', ids)
    res.push(...(data ?? []).filter(e => e.email && e.actif !== false) as { prenom: string | null; email: string }[])
  }
  if (depts.length) {
    const { data } = await sb.from('employes').select('prenom, email, actif').eq('role', 'gestionnaire').in('departement_id', depts)
    res.push(...(data ?? []).filter(e => e.email && e.actif !== false) as { prenom: string | null; email: string }[])
  }
  return res.filter((e, i) => res.findIndex(x => x.email === e.email) === i)
}

/** Courriel aux destinataires : aucun contenu du formulaire (renseignements confidentiels), seulement un lien. */
export async function avertirReception(sb: SupabaseClient, f: Formulaire, reponse: { id: string; numero: number }, origine: string) {
  if (!courrielsActifs()) return
  const liste = await courrielsDestinataires(sb, f)
  if (!liste.length) return
  await envoyerCourriels(liste.map(d => {
    const { html, texte } = gabarit({
      origine, clinique: CLINIQUE_FORMULAIRES,
      titre: 'Nouveau formulaire reçu',
      paragraphes: [
        `Bonjour ${d.prenom ?? ''},`.replace(' ,', ','),
        `Un formulaire « ${f.titre} » (${numeroReponse(reponse.numero)}) vient d’être envoyé et vous a été assigné.`,
        'Pour des raisons de confidentialité, son contenu n’est visible que dans la plateforme.',
      ],
      bouton: { libelle: 'Ouvrir le formulaire', lien: `${origine}/admin/formulaires/reponses/${reponse.id}` },
    })
    return { a: d.email, sujet: `Nouveau formulaire reçu — ${f.titre} ${numeroReponse(reponse.numero)}`, html, texte }
  }))
}

/** Courriel à l'employé : statut mis à jour ou réponse (jamais pour un envoi anonyme). */
export async function avertirEmploye(sb: SupabaseClient, r: { id: string; numero: number; employe_id: string | null; definition: unknown }, quoi: { statut?: StatutReponse; reponse?: boolean }, origine: string) {
  if (!courrielsActifs() || !r.employe_id) return
  const { data: e } = await sb.from('employes').select('prenom, email, actif').eq('id', r.employe_id).maybeSingle()
  if (!e?.email || e.actif === false) return
  const titreF = (r.definition as { titre?: string })?.titre ?? 'Formulaire'
  const ligne = quoi.reponse
    ? `Vous avez reçu une réponse concernant votre formulaire « ${titreF} » (${numeroReponse(r.numero)}).`
    : `Le statut de votre formulaire « ${titreF} » (${numeroReponse(r.numero)}) est maintenant : ${STATUTS[quoi.statut ?? 'recu'].libelle}.`
  const { html, texte } = gabarit({
    origine, clinique: CLINIQUE_FORMULAIRES, titre: quoi.reponse ? 'Réponse à votre formulaire' : 'Suivi de votre formulaire',
    paragraphes: [`Bonjour ${e.prenom ?? ''},`.replace(' ,', ','), ligne],
    bouton: { libelle: 'Voir mon formulaire', lien: `${origine}/dashboard/formulaires/envois/${r.id}` },
  })
  await envoyerCourriels([{ a: e.email, sujet: `${quoi.reponse ? 'Réponse' : 'Suivi'} — ${titreF} ${numeroReponse(r.numero)}`, html, texte }])
}
