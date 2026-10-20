// Export de la conformité : Excel (synthèse + détail + attestations), CSV (détail) ou PDF (rapport / fiche employé).
import { NextRequest, NextResponse } from 'next/server'
import { getActeur, serviceClient, libellePerimetre, departementsVisibles, cliniquesAdministrees } from '@/lib/permissions'
import { aAccesAdmin, CLINIQUE_EMPLOYE_LABEL, CLINIQUE_INFO, estCliniqueEmploye, ROLE_LABEL, type Clinique } from '@/lib/cliniques'
import { chargerConformite, synthese, type EmployeConformite, type AssignationConformite } from '@/lib/conformite'
import { LIBELLE_STATUT, estComplete } from '@/lib/etat-formations'
import { classeurExcel, fichierCsv, nomFichier, reponseFichier, type Colonne } from '@/lib/export-tableur'
import { genererPdf, reponsePdf } from '@/lib/pdf-rapport'
import { logAudit } from '@/lib/audit'

type Ligne = { e: EmployeConformite; a: AssignationConformite }
type LigneAtt = { e: EmployeConformite; a: AssignationConformite; l: NonNullable<AssignationConformite['suivi']>['lecons'][number] }

const jour = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '')
const clinique = (c: string | null) => (estCliniqueEmploye(c) ? CLINIQUE_EMPLOYE_LABEL[c] : '')
const nom = (e: EmployeConformite) => `${e.prenom} ${e.nom}`.trim()
const fr = (iso: string | null | undefined) =>
  iso ? new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('fr-CA', { dateStyle: 'medium', timeZone: 'America/Toronto' }) : ''
const frHeure = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Toronto' }) : ''

const COL_DETAIL: Colonne<Ligne>[] = [
  { titre: 'Employé', valeur: x => nom(x.e), largeur: 24 },
  { titre: 'Courriel', valeur: x => x.e.email, largeur: 28 },
  { titre: 'Clinique', valeur: x => clinique(x.e.clinique), largeur: 14 },
  { titre: 'Département', valeur: x => x.e.departement, largeur: 18 },
  { titre: 'Poste', valeur: x => x.e.poste, largeur: 18 },
  { titre: 'Formation', valeur: x => x.a.formation_titre, largeur: 38 },
  { titre: 'Obligatoire (LSST)', valeur: x => (x.a.obligatoire ? 'Oui' : 'Non'), largeur: 12 },
  { titre: 'Assignée le', valeur: x => jour(x.a.date_assignation), largeur: 12 },
  { titre: 'Échéance', valeur: x => jour(x.a.date_echeance), largeur: 12 },
  { titre: 'En retard', valeur: x => (x.a.en_retard ? 'Oui' : 'Non'), largeur: 10 },
  { titre: 'Statut', valeur: x => LIBELLE_STATUT[x.a.statut], largeur: 14 },
  { titre: 'Progression (%)', valeur: x => x.a.progression, largeur: 12 },
  { titre: 'Leçons terminées', valeur: x => (x.a.suivi ? `${x.a.suivi.lecons_terminees}/${x.a.suivi.lecons_total}` : ''), largeur: 12 },
  { titre: 'Attestations signées', valeur: x => (x.a.suivi?.attestations_requises ? `${x.a.suivi.attestations_signees}/${x.a.suivi.attestations_requises}` : ''), largeur: 12 },
  { titre: 'Vidéos obligatoires vues', valeur: x => (x.a.suivi?.videos_obligatoires ? `${x.a.suivi.videos_vues}/${x.a.suivi.videos_obligatoires}` : ''), largeur: 12 },
  { titre: 'N° certificat', valeur: x => x.a.certificat?.numero_certificat, largeur: 16 },
  { titre: 'Certificat obtenu le', valeur: x => jour(x.a.certificat?.date_emission), largeur: 14 },
  { titre: 'Certificat expire le', valeur: x => jour(x.a.certificat?.date_expiration), largeur: 14 },
  { titre: 'Note (%)', valeur: x => (x.a.certificat?.note_finale != null ? Math.round(Number(x.a.certificat.note_finale)) : ''), largeur: 9 },
  { titre: 'Certificat valide', valeur: x => (x.a.certificat ? (x.a.certificat_valide ? 'Oui' : 'Non (expiré)') : ''), largeur: 12 },
]

const COL_SYNTHESE: Colonne<EmployeConformite>[] = [
  { titre: 'Employé', valeur: e => nom(e), largeur: 24 },
  { titre: 'Courriel', valeur: e => e.email, largeur: 28 },
  { titre: 'Clinique', valeur: e => clinique(e.clinique), largeur: 14 },
  { titre: 'Département', valeur: e => e.departement, largeur: 18 },
  { titre: 'Formations assignées', valeur: e => e.assignations.length, largeur: 12 },
  { titre: 'Terminées ou certifiées', valeur: e => e.assignations.filter(a => estComplete(a.statut)).length, largeur: 12 },
  { titre: 'En retard', valeur: e => e.assignations.filter(a => a.en_retard).length, largeur: 10 },
  { titre: 'Taux (%)', valeur: e => (e.assignations.length ? Math.round((e.assignations.filter(a => estComplete(a.statut)).length / e.assignations.length) * 100) : ''), largeur: 9 },
  { titre: 'Certificats valides', valeur: e => e.assignations.filter(a => a.certificat_valide).length, largeur: 12 },
]

const COL_ATT: Colonne<LigneAtt>[] = [
  { titre: 'Employé', valeur: x => nom(x.e), largeur: 24 },
  { titre: 'Clinique', valeur: x => clinique(x.e.clinique), largeur: 14 },
  { titre: 'Formation', valeur: x => x.a.formation_titre, largeur: 34 },
  { titre: 'Module', valeur: x => x.l.module_titre, largeur: 24 },
  { titre: 'Leçon', valeur: x => x.l.titre, largeur: 30 },
  { titre: 'Leçon terminée le', valeur: x => (x.l.terminee_le ? x.l.terminee_le.slice(0, 16).replace('T', ' ') : ''), largeur: 17 },
  { titre: 'Attestation signée le', valeur: x => (x.l.attestation_le ? x.l.attestation_le.slice(0, 16).replace('T', ' ') : 'Non signée'), largeur: 18 },
  { titre: 'Texte attesté', valeur: x => x.l.attestation_texte, largeur: 50 },
]

export async function GET(req: NextRequest) {
  const acteur = await getActeur()
  if (!acteur || !aAccesAdmin(acteur.role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const sb = serviceClient()
  const sp = req.nextUrl.searchParams
  const format = ['csv', 'pdf'].includes(sp.get('format') ?? '') ? sp.get('format')! : 'xlsx'

  const cl = cliniquesAdministrees(acteur).includes(sp.get('clinique') as Clinique) ? (sp.get('clinique') as Clinique) : null
  const departements = await departementsVisibles(acteur, sb)
  const dep = departements.find(d => d.id === sp.get('departement')) ?? null
  const employe = sp.get('employe')
  const vue = sp.get('vue')

  let donnees = await chargerConformite(sb, acteur, { clinique: cl, departement_id: dep?.id ?? null, employe_ids: employe ? [employe] : null })
  if (employe && donnees.length === 0) return NextResponse.json({ error: 'Employé introuvable ou hors de votre périmètre' }, { status: 404 })
  const s = synthese(donnees)
  if (vue === 'retard' || vue === 'incomplet') {
    donnees = donnees
      .map(e => ({ ...e, assignations: e.assignations.filter(a => (vue === 'retard' ? a.en_retard : !estComplete(a.statut))) }))
      .filter(e => e.assignations.length > 0)
  }

  const detail: Ligne[] = donnees.flatMap(e => e.assignations.map(a => ({ e, a })))
  const attestations: LigneAtt[] = detail.flatMap(({ e, a }) => (a.suivi?.lecons ?? []).filter(l => l.attestation_requise).map(l => ({ e, a, l })))

  const perimetre = [
    libellePerimetre(acteur),
    cl ? `clinique ${CLINIQUE_INFO[cl].court}` : null,
    dep ? `département ${dep.nom}` : null,
    vue === 'retard' ? 'formations en retard' : vue === 'incomplet' ? 'formations à compléter' : null,
  ].filter(Boolean).join(' · ')

  await logAudit({
    acteur_id: acteur.id, type_action: 'EXPORT_DONNEES', cible_employe_id: employe ?? null,
    description: `Export de la conformité (${format.toUpperCase()}${employe ? ', fiche employé' : ''}, ${detail.length} ligne(s))`,
    metadata: { rapport: 'conformite', format, clinique: cl, departement: dep?.nom ?? null, vue },
    ip_address: req.headers.get('x-forwarded-for'), user_agent: req.headers.get('user-agent'),
  })

  const base = employe ? `conformite-${nom(donnees[0] ?? { prenom: 'employe', nom: '' } as EmployeConformite)}` : 'conformite'

  if (format === 'csv') return reponseFichier(fichierCsv(COL_DETAIL, detail), nomFichier(base, 'csv'))

  if (format === 'xlsx') {
    const xlsx = await classeurExcel([
      { nom: 'Synthèse', colonnes: COL_SYNTHESE, lignes: donnees },
      { nom: 'Détail des formations', colonnes: COL_DETAIL, lignes: detail },
      { nom: 'Attestations', colonnes: COL_ATT, lignes: attestations },
    ], { titre: 'Conformité — WS Formation', auteur: `${acteur.prenom ?? ''} ${acteur.nom ?? ''}`.trim() })
    return reponseFichier(xlsx, nomFichier(base, 'xlsx'))
  }

  // PDF
  const genere_par = `${acteur.prenom ?? ''} ${acteur.nom ?? ''} (${ROLE_LABEL[acteur.role]})`.trim()
  if (employe) {
    const e = donnees[0] ?? (await chargerConformite(sb, acteur, { employe_ids: [employe] }))[0]
    const pdf = genererPdf({
      titre: `Fiche de conformité — ${nom(e)}`,
      sousTitre: [e.poste, e.departement, clinique(e.clinique), e.email].filter(Boolean).join(' · '),
      genere_par,
      indicateurs: [
        ['Formations assignées', e.assignations.length],
        ['Terminées ou certifiées', e.assignations.filter(a => estComplete(a.statut)).length],
        ['En retard', e.assignations.filter(a => a.en_retard).length],
        ['Certificats valides', e.assignations.filter(a => a.certificat_valide).length],
      ],
      sections: [
        {
          titre: 'Formations',
          entetes: ['Formation', 'Échéance', 'Statut', 'Progr.', 'Leçons', 'Attestations', 'Certificat', 'Expire le'],
          largeurs: [34, 11, 11, 7, 8, 9, 14, 11],
          lignes: e.assignations.map(a => [
            a.formation_titre + (a.obligatoire ? ' (LSST)' : ''),
            fr(a.date_echeance) + (a.en_retard ? ' — en retard' : ''),
            LIBELLE_STATUT[a.statut],
            a.progression + ' %',
            a.suivi ? `${a.suivi.lecons_terminees}/${a.suivi.lecons_total}` : '',
            a.suivi?.attestations_requises ? `${a.suivi.attestations_signees}/${a.suivi.attestations_requises}` : '',
            a.certificat ? `${a.certificat.numero_certificat ?? ''} (${fr(a.certificat.date_emission)})` : '',
            a.certificat ? (fr(a.certificat.date_expiration) || 'Permanent') : '',
          ]),
        },
        {
          titre: 'Attestations « J’ai lu et compris »',
          sousTitre: 'Preuves horodatées enregistrées par la plateforme.',
          entetes: ['Formation', 'Leçon', 'Signée le', 'Texte attesté'],
          largeurs: [24, 24, 13, 39],
          lignes: attestations.map(x => [x.a.formation_titre, x.l.titre, x.l.attestation_le ? frHeure(x.l.attestation_le) : 'Non signée', x.l.attestation_texte ?? '']),
        },
      ],
    })
    return reponsePdf(pdf, nomFichier(base, 'pdf'))
  }

  const pdf = genererPdf({
    titre: 'Rapport de conformité',
    perimetre, genere_par,
    indicateurs: [
      ['Employés actifs', s.employes],
      ['Formations assignées', s.assignations],
      ['Taux de conformité', s.taux + ' %'],
      ['En retard', s.en_retard],
      ['Certificats valides', s.certificats],
      ['Attestations', s.attestations_requises ? `${s.attestations_signees}/${s.attestations_requises}` : '—'],
    ],
    sections: [
      {
        titre: 'Synthèse par employé',
        entetes: ['Employé', 'Clinique', 'Département', 'Assignées', 'Complétées', 'En retard', 'Taux', 'Certificats'],
        largeurs: [26, 12, 18, 9, 10, 9, 8, 10],
        lignes: donnees.map(e => COL_SYNTHESE.filter(c => c.titre !== 'Courriel').map(c => {
          const v = c.valeur(e)
          return c.titre === 'Taux (%)' && v !== '' ? `${v} %` : (v as string | number)
        })),
      },
      {
        titre: 'Détail des formations',
        entetes: ['Employé', 'Formation', 'Échéance', 'Statut', 'Progr.', 'Attestations', 'Certificat', 'Expire le'],
        largeurs: [20, 32, 12, 11, 7, 9, 12, 11],
        lignes: detail.map(({ e, a }) => [
          nom(e),
          a.formation_titre + (a.obligatoire ? ' (LSST)' : ''),
          fr(a.date_echeance) + (a.en_retard ? ' — en retard' : ''),
          LIBELLE_STATUT[a.statut],
          a.progression + ' %',
          a.suivi?.attestations_requises ? `${a.suivi.attestations_signees}/${a.suivi.attestations_requises}` : '',
          a.certificat ? fr(a.certificat.date_emission) : '',
          a.certificat ? (fr(a.certificat.date_expiration) || 'Permanent') : '',
        ]),
      },
    ],
  })
  return reponsePdf(pdf, nomFichier(base, 'pdf'))
}
