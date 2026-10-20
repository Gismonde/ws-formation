// Export du dossier complet d'un ou plusieurs employés.
// GET ?ids=a,b,c&format=xlsx|zip
//   xlsx : un classeur (Profil, Formations, Leçons, Certificats, Preuves externes, Politiques, Journal*)
//   zip  : le classeur + les documents de preuves externes, rangés par employé
// * Journal : administrateurs seulement. Chaque dossier exporté est inscrit au journal d'audit (Loi 25).
import JSZip from 'jszip'
import { NextRequest, NextResponse } from 'next/server'
import { getActeur, serviceClient, peutVoirEmploye, ipEtAgent } from '@/lib/permissions'
import { aAccesAdmin, estAdministrateur } from '@/lib/cliniques'
import { chargerDossier, feuillesDossiers, type Dossier } from '@/lib/dossier-employe'
import { classeurExcel, nomFichier, reponseFichier } from '@/lib/export-tableur'
import { logAudit } from '@/lib/audit'

const MAX_EMPLOYES = 200
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest) {
  const acteur = await getActeur()
  if (!acteur || !aAccesAdmin(acteur.role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const ids = Array.from(new Set((req.nextUrl.searchParams.get('ids') ?? '').split(',').map(s => s.trim()).filter(s => UUID.test(s))))
  if (ids.length === 0) return NextResponse.json({ error: 'Aucun employé sélectionné' }, { status: 400 })
  if (ids.length > MAX_EMPLOYES) return NextResponse.json({ error: `${MAX_EMPLOYES} employés au maximum par export` }, { status: 400 })
  const format = req.nextUrl.searchParams.get('format') === 'zip' ? 'zip' : 'xlsx'

  const sb = serviceClient()
  const { data: cibles } = await sb.from('employes').select('id, role, clinique, departement_id').in('id', ids)
  const autorises = (cibles ?? []).filter(c => peutVoirEmploye(acteur, c)).map(c => c.id as string)
  if (autorises.length === 0) return NextResponse.json({ error: 'Aucun employé de votre périmètre' }, { status: 404 })

  const journal = estAdministrateur(acteur.role)
  const dossiers = (await Promise.all(autorises.map(id => chargerDossier(sb, id, { journal })))).filter((d): d is Dossier => !!d)
  dossiers.sort((a, b) => `${a.profil.nom} ${a.profil.prenom}`.localeCompare(`${b.profil.nom} ${b.profil.prenom}`, 'fr'))

  const base = dossiers.length === 1 ? `dossier-${dossiers[0].profil.prenom}-${dossiers[0].profil.nom}` : `dossiers-${dossiers.length}-employes`
  const classeur = await classeurExcel(feuillesDossiers(dossiers), { titre: 'Dossiers employés', auteur: 'WS Formation' })

  const { ip_address, user_agent } = ipEtAgent(req)
  await Promise.all(dossiers.map(d => logAudit({
    acteur_id: acteur.id, cible_employe_id: d.profil.id, type_action: 'EXPORT_DONNEES',
    description: `Export du dossier employé (${format === 'zip' ? 'classeur et documents' : 'classeur Excel'})`,
    metadata: { format, nb_employes: dossiers.length }, ip_address, user_agent,
  })))

  if (format === 'xlsx') return reponseFichier(classeur, nomFichier(base, 'xlsx'))

  const zip = new JSZip()
  zip.file(nomFichier(base, 'xlsx'), classeur)
  const manquants: string[] = []
  for (const d of dossiers) {
    const dossierNom = nomFichier(`${d.profil.nom}-${d.profil.prenom}`, 'x').replace(/-\d{4}-\d{2}-\d{2}\.x$/, '')
    const pris = new Set<string>()
    for (const p of d.preuves) {
      if (!p.chemin || /^https?:\/\//.test(p.chemin)) continue
      const { data } = await sb.storage.from('preuves').download(p.chemin)
      if (!data) { manquants.push(`${d.profil.prenom} ${d.profil.nom} : ${p.fichier}`); continue }
      let nom = (p.fichier || p.chemin.split('/').pop() || 'document').replace(/[\\/:*?"<>|]/g, '_').slice(0, 120)
      for (let i = 2; pris.has(nom); i++) nom = nom.replace(/(\.[^.]*)?$/, ` (${i})$1`)
      pris.add(nom)
      zip.file(`preuves/${dossierNom}/${nom}`, Buffer.from(await data.arrayBuffer()))
    }
  }
  if (manquants.length) zip.file('documents-introuvables.txt', manquants.join('\r\n'))
  const contenu = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  return new Response(new Uint8Array(contenu), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${nomFichier(base, 'zip')}"`,
      'Cache-Control': 'no-store',
    },
  })
}
