// Export du journal d'audit filtré : Excel (une feuille « Tous » + une feuille par employé sélectionné)
// ou CSV (un fichier, ou une archive ZIP avec un CSV par employé sélectionné).
import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { getActeur, serviceClient } from '@/lib/permissions'
import { estAdministrateur, CLINIQUE_EMPLOYE_LABEL, estCliniqueEmploye, ROLE_LABEL, estRole } from '@/lib/cliniques'
import { lireFiltresAudit, employesConcernes, requeteAudit, libelleAudit, concerne, type LigneAudit, type EmployeAudit } from '@/lib/audit-journal'
import { classeurExcel, fichierCsv, nomFichier, reponseFichier, type Colonne, type Feuille } from '@/lib/export-tableur'
import { logAudit } from '@/lib/audit'

const MAX_LIGNES = 50000

const heure = (iso: string) => new Date(iso).toLocaleString('fr-CA', { timeZone: 'America/Toronto', hour12: false })
const personne = (p: { prenom?: string | null; nom?: string | null } | null) => (p ? `${p.prenom ?? ''} ${p.nom ?? ''}`.trim() : '')

const COLONNES: Colonne<LigneAudit>[] = [
  { titre: 'Date et heure (Montréal)', valeur: l => heure(l.created_at), largeur: 21 },
  { titre: 'Type', valeur: l => libelleAudit(l.type_action), largeur: 24 },
  { titre: 'Code', valeur: l => l.type_action, largeur: 22 },
  { titre: 'Auteur', valeur: l => personne(l.acteur), largeur: 22 },
  { titre: 'Courriel de l’auteur', valeur: l => l.acteur?.email, largeur: 28 },
  { titre: 'Rôle', valeur: l => (l.acteur && estRole(l.acteur.role) ? ROLE_LABEL[l.acteur.role] : l.acteur?.role), largeur: 18 },
  { titre: 'Clinique', valeur: l => (estCliniqueEmploye(l.acteur?.clinique) ? CLINIQUE_EMPLOYE_LABEL[l.acteur!.clinique as 'CMC'] : ''), largeur: 14 },
  { titre: 'Personne visée', valeur: l => personne(l.cible), largeur: 22 },
  { titre: 'Description', valeur: l => l.description, largeur: 60 },
  { titre: 'Adresse IP', valeur: l => l.ip_address, largeur: 16 },
  { titre: 'Navigateur', valeur: l => l.user_agent, largeur: 40 },
  { titre: 'Identifiant', valeur: l => l.id, largeur: 38 },
]

async function toutesLesLignes(q: { range: (a: number, b: number) => Promise<{ data: LigneAudit[] | null; error: unknown }> }): Promise<LigneAudit[]> {
  const lignes: LigneAudit[] = []
  for (let debut = 0; debut < MAX_LIGNES; debut += 1000) {
    const { data, error } = await q.range(debut, debut + 999)
    if (error) throw error
    lignes.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return lignes
}

export async function GET(req: NextRequest) {
  const acteur = await getActeur()
  if (!acteur || !estAdministrateur(acteur.role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const sb = serviceClient()
  const sp = req.nextUrl.searchParams
  const format = sp.get('format') === 'csv' ? 'csv' : 'xlsx'
  const parEmploye = sp.get('par_employe') === '1'
  const filtres = lireFiltresAudit(sp)

  const employes = await employesConcernes(sb, acteur, filtres)
  const q = requeteAudit(sb, filtres, employes?.map(e => e.id) ?? null)
  const lignes = q ? await toutesLesLignes(q) : []
  // Un fichier par employé : seulement pour les employés choisis explicitement (et dans la portée)
  const choisis: EmployeAudit[] = parEmploye && filtres.employe_ids.length ? (employes ?? []).filter(e => filtres.employe_ids.includes(e.id)) : []

  await logAudit({
    acteur_id: acteur.id, type_action: 'EXPORT_DONNEES',
    description: `Export du journal d'audit (${format.toUpperCase()}, ${lignes.length} entrée(s)${choisis.length ? `, ${choisis.length} employé(s) séparé(s)` : ''})`,
    metadata: { rapport: 'audit', format, filtres, par_employe: parEmploye },
    ip_address: req.headers.get('x-forwarded-for'), user_agent: req.headers.get('user-agent'),
  })

  const nomEmploye = (e: EmployeAudit) => `${e.prenom ?? ''} ${e.nom ?? ''}`.trim() || e.email || e.id
  if (format === 'xlsx') {
    const feuilles: Feuille<LigneAudit>[] = [{ nom: choisis.length ? 'Tous les employés choisis' : 'Journal d’audit', colonnes: COLONNES, lignes }]
    for (const e of choisis) feuilles.push({ nom: nomEmploye(e), colonnes: COLONNES, lignes: lignes.filter(l => concerne(l, e.id)) })
    const xlsx = await classeurExcel(feuilles, { titre: "Journal d'audit — WS Formation" })
    return reponseFichier(xlsx, nomFichier(choisis.length === 1 ? `audit-${nomEmploye(choisis[0])}` : 'journal-audit', 'xlsx'))
  }

  if (choisis.length <= 1) {
    const base = choisis.length === 1 ? `audit-${nomEmploye(choisis[0])}` : 'journal-audit'
    return reponseFichier(fichierCsv(COLONNES, choisis.length === 1 ? lignes.filter(l => concerne(l, choisis[0].id)) : lignes), nomFichier(base, 'csv'))
  }
  // Plusieurs employés : une archive ZIP contenant un CSV par employé + un CSV global
  const zip = new JSZip()
  const pris = new Set<string>()
  zip.file(nomFichier('tous-les-employes', 'csv'), fichierCsv(COLONNES, lignes))
  for (const e of choisis) {
    let nom = nomFichier(`audit-${nomEmploye(e)}`, 'csv')
    for (let i = 2; pris.has(nom); i++) nom = nomFichier(`audit-${nomEmploye(e)}-${i}`, 'csv')
    pris.add(nom)
    zip.file(nom, fichierCsv(COLONNES, lignes.filter(l => concerne(l, e.id))))
  }
  const contenu = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  return new Response(new Uint8Array(contenu), {
    headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${nomFichier('journal-audit-par-employe', 'zip')}"`, 'Cache-Control': 'no-store' },
  })
}
