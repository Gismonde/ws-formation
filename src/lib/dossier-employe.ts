// Dossier complet d'un employé (fiche admin, export) : profil, formations et progression, leçons,
// certificats, preuves externes, politiques confirmées, journal. Côté serveur, clé de service.
// Les droits (peutVoirEmploye) sont vérifiés par l'appelant.
import type { SupabaseClient } from '@supabase/supabase-js'
import { chargerEtatsFormations, certificatValide, LIBELLE_STATUT, type StatutFormation } from '@/lib/etat-formations'
import { chargerSuiviFormations, suiviDe } from '@/lib/suivi-formations'
import { cliniqueAffichee, CLINIQUE_EMPLOYE_LABEL, ROLE_LABEL, type Role } from '@/lib/cliniques'
import { libelleAudit } from '@/lib/audit-journal-libelles'
import type { Colonne, Feuille } from '@/lib/export-tableur'

export type ProfilDossier = {
  id: string
  prenom: string
  nom: string
  email: string
  poste: string
  role: string
  role_libelle: string
  clinique: string
  departement: string
  date_embauche: string | null
  actif: boolean
  invitation_acceptee: boolean
  cree_le: string | null
}

export type FormationDossier = {
  formation_id: string
  titre: string
  obligatoire: boolean
  assignee_le: string | null
  echeance: string | null
  en_retard: boolean
  statut: StatutFormation
  statut_libelle: string
  progression: number
  lecons: string
  certificat: string
}

export type LeconDossier = {
  formation: string
  module: string
  lecon: string
  terminee_le: string | null
  videos: string
  attestation: string
  attestation_le: string | null
}

export type CertificatDossier = {
  id: string
  formation: string
  /** Heures de formation continue créditables (null si la formation n'en donne pas) */
  heures: number | null
  organisme: string | null
  numero: string
  emis_le: string | null
  expire_le: string | null
  note: number | null
  etat: 'Valide' | 'Expiré' | 'Révoqué'
}

export type PreuveDossier = {
  id: string
  formation: string
  fichier: string
  chemin: string | null
  statut: 'en_attente' | 'valide' | 'refuse'
  statut_libelle: string
  commentaire: string
  soumis_le: string | null
  traite_le: string | null
}

export type PolitiqueDossier = { politique: string; version: number; confirme_le: string; texte: string }
export type EvenementDossier = { date: string; action: string; description: string; par: string }

export type Dossier = {
  profil: ProfilDossier
  formations: FormationDossier[]
  lecons: LeconDossier[]
  certificats: CertificatDossier[]
  preuves: PreuveDossier[]
  politiques: PolitiqueDossier[]
  journal: EvenementDossier[]
}

/** Statut d'une preuve : la base a connu « valide/validee » et « refuse/refusee ». */
export function statutPreuve(s: string | null | undefined): PreuveDossier['statut'] {
  if (s === 'valide' || s === 'validee') return 'valide'
  if (s === 'refuse' || s === 'refusee') return 'refuse'
  return 'en_attente'
}
const LIBELLE_PREUVE = { en_attente: 'En attente', valide: 'Validée', refuse: 'Refusée' } as const

const jourSeul = (d: string | null | undefined) => (d ? d.slice(0, 10) : null)

export async function chargerDossier(
  sb: SupabaseClient,
  employeId: string,
  options: { journal?: boolean } = {},
): Promise<Dossier | null> {
  const { data: e } = await sb.from('employes')
    .select('id, prenom, nom, email, poste, role, clinique, departement, date_embauche, actif, auth_user_id, created_at, departements(nom)')
    .eq('id', employeId).maybeSingle()
  if (!e) return null

  const [{ data: assignations }, { data: certs }, { data: preuves }, { data: confs }] = await Promise.all([
    sb.from('assignations').select('formation_id, date_assignation, date_echeance').eq('employe_id', employeId),
    sb.from('certificats').select('id, formation_id, numero_certificat, date_emission, date_expiration, valide, note_finale').eq('employe_id', employeId)
      .order('date_emission', { ascending: false }),
    sb.from('preuves_externes').select('id, formation_id, nom_fichier, fichier_url, statut, commentaire, soumis_le, valide_le').eq('employe_id', employeId)
      .order('soumis_le', { ascending: false }),
    sb.from('politiques_confirmations').select('politique_id, version, confirme_le, texte').eq('employe_id', employeId)
      .order('confirme_le', { ascending: false }),
  ])

  const formationIds = Array.from(new Set([
    ...(assignations ?? []).map(a => a.formation_id as string),
    ...(certs ?? []).map(c => c.formation_id as string),
    ...(preuves ?? []).map(p => p.formation_id as string).filter(Boolean),
  ]))
  const [{ data: formations }, etat, suivi, { data: pols }] = await Promise.all([
    formationIds.length ? sb.from('formations').select('*').in('id', formationIds) : Promise.resolve({ data: [] as { id: string; titre: string; obligatoire: boolean | null }[] }),
    chargerEtatsFormations(sb, [employeId], formationIds),
    chargerSuiviFormations(sb, [employeId], formationIds),
    (confs ?? []).length
      ? sb.from('politiques').select('id, titre').in('id', Array.from(new Set((confs ?? []).map(c => c.politique_id as string))))
      : Promise.resolve({ data: [] as { id: string; titre: string }[] }),
  ])
  const titre = new Map((formations ?? []).map(f => [f.id as string, f]))
  const nomFormation = (id: string | null) => (id ? titre.get(id)?.titre ?? 'Formation supprimée' : '—')
  const aujourdhui = new Date().toISOString().slice(0, 10)

  const lignesFormations: FormationDossier[] = (assignations ?? []).map(a => {
    const ef = etat(employeId, a.formation_id)
    const s = suiviDe(suivi, employeId, a.formation_id)
    const echeance = jourSeul(a.date_echeance)
    const fini = ef.statut === 'termine' || ef.statut === 'certifie'
    return {
      formation_id: a.formation_id,
      titre: nomFormation(a.formation_id),
      obligatoire: titre.get(a.formation_id)?.obligatoire === true,
      assignee_le: jourSeul(a.date_assignation),
      echeance,
      en_retard: !!echeance && !fini && echeance < aujourdhui,
      statut: ef.statut,
      statut_libelle: LIBELLE_STATUT[ef.statut],
      progression: ef.progression,
      lecons: s && s.lecons_total ? `${s.lecons_terminees}/${s.lecons_total}` : '—',
      certificat: ef.certificat?.numero_certificat ?? '',
    }
  }).sort((x, y) => x.titre.localeCompare(y.titre, 'fr'))

  const lecons: LeconDossier[] = []
  for (const f of lignesFormations) {
    const s = suiviDe(suivi, employeId, f.formation_id)
    for (const l of s?.lecons ?? []) {
      lecons.push({
        formation: f.titre, module: l.module_titre, lecon: l.titre, terminee_le: l.terminee_le,
        videos: l.videos_obligatoires ? `${l.videos_vues}/${l.videos_obligatoires}` : '—',
        attestation: !l.attestation_requise ? 'Non requise' : l.attestation_le ? 'Signée' : 'En attente',
        attestation_le: l.attestation_le,
      })
    }
  }

  const certificats: CertificatDossier[] = (certs ?? []).map(c => ({
    id: c.id,
    formation: nomFormation(c.formation_id),
    ...(() => {
      const f = titre.get(c.formation_id) as { credits_admissible?: boolean; credits_heures?: number | null; credits_organisme?: string | null } | undefined
      return f?.credits_admissible && f.credits_heures ? { heures: Number(f.credits_heures), organisme: f.credits_organisme ?? null } : { heures: null, organisme: null }
    })(),
    numero: c.numero_certificat ?? '',
    emis_le: jourSeul(c.date_emission),
    expire_le: jourSeul(c.date_expiration),
    note: c.note_finale != null ? Math.round(Number(c.note_finale)) : null,
    etat: c.valide === false ? 'Révoqué' : certificatValide(c) ? 'Valide' : 'Expiré',
  }))

  const lignesPreuves: PreuveDossier[] = (preuves ?? []).map(p => {
    const st = statutPreuve(p.statut)
    return {
      id: p.id, formation: p.formation_id ? nomFormation(p.formation_id) : 'Autre formation',
      fichier: p.nom_fichier ?? '', chemin: p.fichier_url ?? null, statut: st, statut_libelle: LIBELLE_PREUVE[st],
      commentaire: p.commentaire ?? '', soumis_le: p.soumis_le ?? null, traite_le: p.valide_le ?? null,
    }
  })

  const nomPol = new Map((pols ?? []).map(p => [p.id as string, p.titre as string]))
  const politiques: PolitiqueDossier[] = (confs ?? []).map(c => ({
    politique: nomPol.get(c.politique_id) ?? 'Politique supprimée', version: c.version, confirme_le: c.confirme_le, texte: c.texte,
  }))

  let journal: EvenementDossier[] = []
  if (options.journal) {
    const { data: logs } = await sb.from('audit_logs')
      .select('created_at, type_action, description, acteur:employes!audit_logs_acteur_id_fkey(prenom, nom)')
      .or(`acteur_id.eq.${employeId},cible_employe_id.eq.${employeId}`)
      .order('created_at', { ascending: false }).limit(500)
    journal = (logs ?? []).map(l => {
      const a = l.acteur as { prenom?: string; nom?: string } | { prenom?: string; nom?: string }[] | null
      const ac = Array.isArray(a) ? a[0] : a
      return {
        date: l.created_at, action: libelleAudit(l.type_action), description: l.description ?? '',
        par: ac ? `${ac.prenom ?? ''} ${ac.nom ?? ''}`.trim() : '',
      }
    })
  }

  const cl = cliniqueAffichee(e.clinique, e.role)
  const dep = e.departements as { nom?: string } | { nom?: string }[] | null
  return {
    profil: {
      id: e.id, prenom: e.prenom ?? '', nom: e.nom ?? '', email: e.email ?? '', poste: e.poste ?? '',
      role: e.role, role_libelle: ROLE_LABEL[e.role as Role] ?? e.role,
      clinique: cl ? CLINIQUE_EMPLOYE_LABEL[cl] : '',
      departement: (Array.isArray(dep) ? dep[0]?.nom : dep?.nom) ?? e.departement ?? '',
      date_embauche: e.date_embauche ?? null, actif: e.actif !== false, invitation_acceptee: !!e.auth_user_id, cree_le: e.created_at ?? null,
    },
    formations: lignesFormations, lecons, certificats, preuves: lignesPreuves, politiques, journal,
  }
}

// ---------------------------------------------------------------------------
// Export Excel : un employé (feuilles du dossier) ou plusieurs (mêmes feuilles, colonne « Employé » en tête)

type AvecEmploye<T> = T & { _employe: string }
const dt = (v: string | null | undefined) => (v ? new Date(v.length === 10 ? v + 'T12:00:00' : v) : null)

export function feuillesDossiers(dossiers: Dossier[]): Feuille<unknown>[] {
  const plusieurs = dossiers.length > 1
  const qui = (d: Dossier) => `${d.profil.prenom} ${d.profil.nom}`.trim()
  function feuille<T>(nom: string, colonnes: Colonne<T>[], extraire: (d: Dossier) => T[]): Feuille<unknown> {
    const lignes = dossiers.flatMap(d => extraire(d).map(l => ({ ...l, _employe: qui(d) }) as AvecEmploye<T>))
    const cols = (plusieurs ? [{ titre: 'Employé', valeur: (l: AvecEmploye<T>) => l._employe, largeur: 24 } as Colonne<AvecEmploye<T>>] : [])
      .concat(colonnes as Colonne<AvecEmploye<T>>[])
    return { nom, colonnes: cols, lignes } as Feuille<unknown>
  }

  return [
    feuille<ProfilDossier>('Profil', [
      ...(plusieurs ? [] : [{ titre: 'Prénom', valeur: (p: ProfilDossier) => p.prenom, largeur: 16 }, { titre: 'Nom', valeur: (p: ProfilDossier) => p.nom, largeur: 18 }]),
      { titre: 'Courriel', valeur: p => p.email, largeur: 30 },
      { titre: 'Poste', valeur: p => p.poste, largeur: 22 },
      { titre: 'Type de compte', valeur: p => p.role_libelle, largeur: 22 },
      { titre: 'Clinique', valeur: p => p.clinique, largeur: 22 },
      { titre: 'Département', valeur: p => p.departement, largeur: 20 },
      { titre: "Date d'embauche", valeur: p => dt(p.date_embauche), largeur: 14 },
      { titre: 'Statut', valeur: p => (p.actif ? 'Actif' : 'Archivé'), largeur: 10 },
      { titre: 'Invitation', valeur: p => (p.invitation_acceptee ? 'Acceptée' : 'En attente'), largeur: 12 },
      { titre: 'Compte créé le', valeur: p => dt(p.cree_le), largeur: 14 },
    ], d => [d.profil]),
    feuille<FormationDossier>('Formations', [
      { titre: 'Formation', valeur: f => f.titre, largeur: 40 },
      { titre: 'Obligatoire', valeur: f => (f.obligatoire ? 'Oui' : 'Non'), largeur: 11 },
      { titre: 'Assignée le', valeur: f => dt(f.assignee_le), largeur: 13 },
      { titre: 'Échéance', valeur: f => dt(f.echeance), largeur: 13 },
      { titre: 'En retard', valeur: f => (f.en_retard ? 'Oui' : ''), largeur: 10 },
      { titre: 'Statut', valeur: f => f.statut_libelle, largeur: 14 },
      { titre: 'Progression (%)', valeur: f => f.progression, largeur: 14 },
      { titre: 'Leçons terminées', valeur: f => f.lecons, largeur: 15 },
      { titre: 'Certificat', valeur: f => f.certificat, largeur: 18 },
    ], d => d.formations),
    feuille<LeconDossier>('Leçons', [
      { titre: 'Formation', valeur: l => l.formation, largeur: 34 },
      { titre: 'Module', valeur: l => l.module, largeur: 24 },
      { titre: 'Leçon', valeur: l => l.lecon, largeur: 34 },
      { titre: 'Terminée le', valeur: l => dt(l.terminee_le), largeur: 18 },
      { titre: 'Vidéos obligatoires vues', valeur: l => l.videos, largeur: 14 },
      { titre: '« Lu et compris »', valeur: l => l.attestation, largeur: 14 },
      { titre: 'Signé le', valeur: l => dt(l.attestation_le), largeur: 18 },
    ], d => d.lecons),
    feuille<CertificatDossier>('Certificats', [
      { titre: 'Formation', valeur: c => c.formation, largeur: 40 },
      { titre: 'Numéro', valeur: c => c.numero, largeur: 20 },
      { titre: 'Émis le', valeur: c => dt(c.emis_le), largeur: 13 },
      { titre: 'Expire le', valeur: c => dt(c.expire_le), largeur: 13 },
      { titre: 'Note (%)', valeur: c => c.note, largeur: 10 },
      { titre: 'État', valeur: c => c.etat, largeur: 10 },
      { titre: 'Heures créditables', valeur: c => c.heures, largeur: 12 },
      { titre: 'Ordre / organisme', valeur: c => c.organisme, largeur: 18 },
    ], d => d.certificats),
    feuille<PreuveDossier>('Preuves externes', [
      { titre: 'Formation', valeur: p => p.formation, largeur: 34 },
      { titre: 'Fichier', valeur: p => p.fichier, largeur: 34 },
      { titre: 'Statut', valeur: p => p.statut_libelle, largeur: 12 },
      { titre: 'Commentaire', valeur: p => p.commentaire, largeur: 30 },
      { titre: 'Soumise le', valeur: p => dt(p.soumis_le), largeur: 18 },
      { titre: 'Traitée le', valeur: p => dt(p.traite_le), largeur: 18 },
    ], d => d.preuves),
    feuille<PolitiqueDossier>('Politiques', [
      { titre: 'Politique', valeur: p => p.politique, largeur: 36 },
      { titre: 'Version', valeur: p => p.version, largeur: 9 },
      { titre: 'Confirmée le', valeur: p => dt(p.confirme_le), largeur: 18 },
      { titre: 'Texte accepté', valeur: p => p.texte, largeur: 60 },
    ], d => d.politiques),
    ...(dossiers.some(d => d.journal.length) ? [feuille<EvenementDossier>('Journal', [
      { titre: 'Date', valeur: j => dt(j.date), largeur: 18 },
      { titre: 'Action', valeur: j => j.action, largeur: 26 },
      { titre: 'Description', valeur: j => j.description, largeur: 50 },
      { titre: 'Par', valeur: j => j.par, largeur: 22 },
    ], d => d.journal)] : []),
  ]
}
