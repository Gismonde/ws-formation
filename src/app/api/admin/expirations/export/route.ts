import { NextRequest, NextResponse } from 'next/server'
import { getActeur, serviceClient } from '@/lib/permissions'
import { aAccesAdmin, CLINIQUE_EMPLOYE_LABEL, estCliniqueEmploye } from '@/lib/cliniques'
import { chargerExpirations, type LigneExpiration, type StatutExpiration } from '@/lib/expirations'
import { classeurExcel, fichierCsv, nomFichier, reponseFichier, type Colonne } from '@/lib/export-tableur'
import { logAudit } from '@/lib/audit'

const LIBELLE: Record<StatutExpiration, string> = { expire: 'Expiré', bientot: 'Expire bientôt', valide: 'Valide' }

const COLONNES: Colonne<LigneExpiration>[] = [
  { titre: 'Employé', valeur: l => l.employe_nom, largeur: 26 },
  { titre: 'Courriel', valeur: l => l.employe_email, largeur: 30 },
  { titre: 'Clinique', valeur: l => (estCliniqueEmploye(l.clinique) ? CLINIQUE_EMPLOYE_LABEL[l.clinique] : ''), largeur: 14 },
  { titre: 'Département', valeur: l => l.departement, largeur: 20 },
  { titre: 'Formation', valeur: l => l.formation_titre, largeur: 40 },
  { titre: 'N° certificat', valeur: l => l.numero_certificat, largeur: 16 },
  { titre: 'Obtenu le', valeur: l => l.date_emission?.slice(0, 10), largeur: 12 },
  { titre: 'Expire le', valeur: l => l.date_expiration.slice(0, 10), largeur: 12 },
  { titre: 'Jours restants', valeur: l => l.jours_restants, largeur: 14 },
  { titre: 'Statut', valeur: l => LIBELLE[l.statut], largeur: 16 },
]

export async function GET(req: NextRequest) {
  const acteur = await getActeur()
  if (!acteur || !aAccesAdmin(acteur.role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const sp = req.nextUrl.searchParams
  const horizon = [30, 60, 90].includes(Number(sp.get('horizon'))) ? Number(sp.get('horizon')) : 60
  const statut = sp.get('statut')
  const format = sp.get('format') === 'csv' ? 'csv' : 'xlsx'

  const toutes = await chargerExpirations(serviceClient(), acteur, horizon)
  const lignes = statut && statut !== 'tous' ? toutes.filter(l => l.statut === statut) : toutes

  await logAudit({
    acteur_id: acteur.id, type_action: 'EXPORT_DONNEES',
    description: `Export des expirations de certificats (${format.toUpperCase()}, ${lignes.length} ligne(s))`,
    metadata: { rapport: 'expirations', statut: statut ?? 'tous', horizon },
    ip_address: req.headers.get('x-forwarded-for'), user_agent: req.headers.get('user-agent'),
  })

  const base = 'expirations-certificats'
  if (format === 'csv') return reponseFichier(fichierCsv(COLONNES, lignes), nomFichier(base, 'csv'))
  const xlsx = await classeurExcel([{ nom: 'Expirations', colonnes: COLONNES, lignes }], { titre: 'Expiration des certificats' })
  return reponseFichier(xlsx, nomFichier(base, 'xlsx'))
}
