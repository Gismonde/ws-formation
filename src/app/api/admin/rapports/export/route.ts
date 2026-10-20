// Export de la page Rapports : progression par formation (Excel ou PDF).
import { NextRequest, NextResponse } from 'next/server'
import { getActeur, serviceClient, cliniquesAdministrees } from '@/lib/permissions'
import { aAccesAdmin, ROLE_LABEL } from '@/lib/cliniques'
import { chargerConformite, synthese, rapportParFormation, formationsDuRapport, type LigneRapportFormation } from '@/lib/conformite'
import { classeurExcel, nomFichier, reponseFichier, type Colonne } from '@/lib/export-tableur'
import { genererPdf, reponsePdf } from '@/lib/pdf-rapport'
import { logAudit } from '@/lib/audit'

const clinique = (c: string | null) => (c === 'LES_DEUX' ? 'CMC + WSSC' : c ?? '')

const COLONNES: Colonne<LigneRapportFormation>[] = [
  { titre: 'Formation', valeur: l => l.titre, largeur: 42 },
  { titre: 'Catégorie', valeur: l => l.categorie, largeur: 22 },
  { titre: 'Clinique', valeur: l => clinique(l.clinique), largeur: 12 },
  { titre: 'Obligatoire (LSST)', valeur: l => (l.obligatoire ? 'Oui' : 'Non'), largeur: 12 },
  { titre: 'Assignés', valeur: l => l.assignes, largeur: 10 },
  { titre: 'Complétés', valeur: l => l.completes, largeur: 10 },
  { titre: 'En cours', valeur: l => l.en_cours, largeur: 10 },
  { titre: 'Non commencés', valeur: l => l.non_commences, largeur: 12 },
  { titre: 'En retard', valeur: l => l.en_retard, largeur: 10 },
  { titre: 'Certificats valides', valeur: l => l.certificats, largeur: 12 },
  { titre: 'Taux de complétion (%)', valeur: l => (l.assignes ? l.taux : ''), largeur: 14 },
]

export async function GET(req: NextRequest) {
  const acteur = await getActeur()
  if (!acteur || !aAccesAdmin(acteur.role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const sb = serviceClient()
  const format = req.nextUrl.searchParams.get('format') === 'pdf' ? 'pdf' : 'xlsx'

  const [donnees, formations] = await Promise.all([chargerConformite(sb, acteur), formationsDuRapport(sb, acteur)])
  const s = synthese(donnees)
  const lignes = rapportParFormation(donnees, formations)

  await logAudit({
    acteur_id: acteur.id, type_action: 'EXPORT_DONNEES',
    description: `Export des rapports (${format.toUpperCase()}, ${lignes.length} formation(s))`,
    metadata: { rapport: 'rapports', format },
    ip_address: req.headers.get('x-forwarded-for'), user_agent: req.headers.get('user-agent'),
  })

  if (format === 'xlsx') {
    const xlsx = await classeurExcel([{ nom: 'Progression par formation', colonnes: COLONNES, lignes }], { titre: 'Rapports — WS Formation' })
    return reponseFichier(xlsx, nomFichier('rapport-formations', 'xlsx'))
  }

  const pdf = genererPdf({
    titre: 'Rapport de progression des formations',
    perimetre: acteur.role === 'super_admin' ? 'CMC + WSSC' : acteur.role === 'gestionnaire' ? 'mon département' : cliniquesAdministrees(acteur).join(' + '),
    genere_par: `${acteur.prenom ?? ''} ${acteur.nom ?? ''} (${ROLE_LABEL[acteur.role]})`.trim(),
    indicateurs: [
      ['Formations publiées', formations.length],
      ['Employés actifs', s.employes],
      ['Taux de complétion', s.taux + ' %'],
      ['En retard', s.en_retard],
      ['Certificats valides', s.certificats],
    ],
    sections: [{
      titre: 'Progression par formation',
      entetes: ['Formation', 'Clinique', 'LSST', 'Assignés', 'Complétés', 'En cours', 'En retard', 'Certificats', 'Taux'],
      largeurs: [40, 10, 6, 8, 9, 8, 8, 9, 7],
      lignes: lignes.map(l => [l.titre, clinique(l.clinique), l.obligatoire ? 'Oui' : '', l.assignes, l.completes, l.en_cours, l.en_retard, l.certificats, l.assignes ? l.taux + ' %' : '—']),
    }],
  })
  return reponsePdf(pdf, nomFichier('rapport-formations', 'pdf'))
}
