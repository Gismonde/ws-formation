// Import d'employés (Excel .xlsx ou CSV). POST multipart { fichier, action: 'apercu' | 'creer' }.
// L'aperçu valide chaque ligne sans rien créer ; la création relit le fichier et revalide tout côté serveur.
import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { getActeur, serviceClient, validerAttribution, departementsVisibles, rolesAttribuables, cliniquesAttribuables, ipEtAgent } from '@/lib/permissions'
import { aAccesAdmin, ROLE_LABEL } from '@/lib/cliniques'
import { analyserImport, lireCsv, type LigneImport } from '@/lib/import-employes'
import { inviterEmploye } from '@/lib/invitations'
import { origineDepuis } from '@/lib/courriels'
import { logAudit } from '@/lib/audit'

export const maxDuration = 300
const TAILLE_MAX = 5 * 1024 * 1024

function texteCellule(v: ExcelJS.CellValue): string {
  if (v == null) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'object') {
    if ('text' in v && v.text != null) return typeof v.text === 'string' ? v.text : texteCellule(v.text as ExcelJS.CellValue)
    if ('richText' in v) return v.richText.map(r => r.text).join('')
    if ('result' in v) return texteCellule(v.result as ExcelJS.CellValue)
    return ''
  }
  return String(v)
}

async function lireFichier(f: File): Promise<string[][]> {
  const buf = Buffer.from(await f.arrayBuffer())
  if (/\.xlsx$/i.test(f.name)) {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf as unknown as ArrayBuffer)
    const ws = wb.worksheets[0]
    if (!ws) return []
    const lignes: string[][] = []
    ws.eachRow({ includeEmpty: false }, row => {
      const vals = row.values as ExcelJS.CellValue[]
      lignes.push(vals.slice(1).map(v => texteCellule(v).trim()))
    })
    return lignes.filter(l => l.some(x => x !== ''))
  }
  return lireCsv(buf.toString('utf8'))
}

export async function POST(req: Request) {
  const acteur = await getActeur()
  if (!acteur || !aAccesAdmin(acteur.role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  if (acteur.role === 'gestionnaire' && (!acteur.departement_id || !acteur.clinique)) {
    return NextResponse.json({ error: 'Aucun département ou aucune clinique ne vous est attribué.' }, { status: 403 })
  }

  const form = await req.formData().catch(() => null)
  const fichier = form?.get('fichier')
  const action = form?.get('action') === 'creer' ? 'creer' : 'apercu'
  if (!(fichier instanceof File) || !/\.(xlsx|csv|txt)$/i.test(fichier.name)) {
    return NextResponse.json({ error: 'format' }, { status: 400 })
  }
  if (fichier.size > TAILLE_MAX) return NextResponse.json({ error: 'taille' }, { status: 400 })

  let brutes: string[][]
  try { brutes = await lireFichier(fichier) } catch { return NextResponse.json({ error: 'lecture' }, { status: 400 }) }
  if (brutes.length < 2) return NextResponse.json({ error: 'vide' }, { status: 400 })

  const sb = serviceClient()
  const departements = await departementsVisibles(acteur, sb)
  const emails = brutes.slice(1).flat().map(x => x.toLowerCase()).filter(x => x.includes('@'))
  const { data: existants } = emails.length
    ? await sb.from('employes').select('email').in('email', Array.from(new Set(emails)))
    : { data: [] as { email: string }[] }
  const { lignes, colonnesManquantes } = analyserImport(brutes, {
    departements,
    cliniquesPossibles: cliniquesAttribuables(acteur),
    rolesPossibles: rolesAttribuables(acteur),
    emailsExistants: new Set((existants ?? []).map(e => String(e.email).toLowerCase())),
    imposer: acteur.role === 'gestionnaire' ? { clinique: acteur.clinique!, departement_id: acteur.departement_id! } : null,
  })
  if (colonnesManquantes.length) return NextResponse.json({ error: 'colonnes', colonnesManquantes }, { status: 400 })
  const total = brutes.length - 1

  if (action === 'apercu') return NextResponse.json({ lignes, total })

  // Création : uniquement les lignes valides, une à une
  const origine = origineDepuis(req)
  const resultats: { numero: number; email: string; ok: boolean; erreur?: string; employeId?: string; lien?: string | null; courrielEnvoye?: boolean }[] = []
  for (const l of lignes as LigneImport[]) {
    if (l.erreurs.length) continue
    const attribution = await validerAttribution(acteur, { role: l.role, clinique: l.clinique, departement_id: l.departement_id }, sb)
    if ('erreur' in attribution) { resultats.push({ numero: l.numero, email: l.email, ok: false, erreur: attribution.erreur }); continue }
    const { role, clinique, departement_id } = attribution.valeurs
    const inv = await inviterEmploye(sb, { email: l.email, prenom: l.prenom, nom: l.nom, clinique, origine, nouveau: true })
    if (!inv.authUserId) {
      resultats.push({ numero: l.numero, email: l.email, ok: false, erreur: /already|registered|exists/i.test(inv.erreur ?? '') ? 'Un compte existe déjà avec ce courriel.' : (inv.erreur ?? 'Création du compte impossible') })
      continue
    }
    const { data: emp, error } = await sb.from('employes').insert({
      auth_user_id: inv.authUserId, prenom: l.prenom, nom: l.nom, email: l.email, role, clinique, departement_id,
      poste: l.poste || null, peut_creer_formations: false, actif: true,
    }).select('id').single()
    if (error || !emp) {
      await sb.auth.admin.deleteUser(inv.authUserId)
      resultats.push({ numero: l.numero, email: l.email, ok: false, erreur: error?.message ?? 'Erreur' })
      continue
    }
    await logAudit({
      acteur_id: acteur.id, type_action: 'EMPLOYE_CREE', cible_employe_id: emp.id,
      description: `Nouvel employé importé (${fichier.name}) : ${l.prenom} ${l.nom} (${l.email}) — ${ROLE_LABEL[role]}${clinique ? ', ' + clinique : ''}`,
      metadata: { role, clinique, departement_id, invitation_envoyee: inv.courrielEnvoye, import: fichier.name },
      ...ipEtAgent(req),
    })
    resultats.push({ numero: l.numero, email: l.email, ok: true, employeId: emp.id, lien: inv.courrielEnvoye ? null : inv.lien, courrielEnvoye: inv.courrielEnvoye })
  }
  return NextResponse.json({ resultats, ignorees: lignes.filter(l => l.erreurs.length).length })
}
