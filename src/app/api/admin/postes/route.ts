// Liste officielle des postes (administrateurs).
// GET : postes + postes saisis hors liste (avec suggestion)
// POST { action: 'ajouter', nom, famille } | { action: 'modifier', id, nom?, famille?, actif? } | { action: 'correspondance', ancien, nouveau }
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, filtrerEmployes, ipEtAgent } from '@/lib/permissions'
import { estAdministrateur } from '@/lib/cliniques'
import { chargerPostes, normPoste, suggererPoste } from '@/lib/postes'
import { logAudit } from '@/lib/audit'

async function admin() {
  const a = await getActeur()
  return a && estAdministrateur(a.role) ? a : null
}

export async function GET() {
  const a = await admin()
  if (!a) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const sb = serviceClient()
  const postes = await chargerPostes(sb, true)
  const { data: emps } = await filtrerEmployes(sb.from('employes').select('poste').not('poste', 'is', null), a)
  const officiels = new Set(postes.map(p => normPoste(p.nom)))
  const compte = new Map<string, number>()
  const parPoste = new Map<string, number>()
  for (const e of emps ?? []) {
    const p = String(e.poste ?? '').trim()
    if (!p) continue
    if (officiels.has(normPoste(p))) parPoste.set(normPoste(p), (parPoste.get(normPoste(p)) ?? 0) + 1)
    else compte.set(p, (compte.get(p) ?? 0) + 1)
  }
  const actifs = postes.filter(p => p.actif).map(p => p.nom)
  return NextResponse.json({
    postes: postes.map(p => ({ ...p, employes: parPoste.get(normPoste(p.nom)) ?? 0 })),
    horsListe: Array.from(compte, ([poste, n]) => ({ poste, employes: n, suggestion: suggererPoste(poste, actifs) })).sort((x, y) => y.employes - x.employes),
  })
}

export async function POST(req: Request) {
  const a = await admin()
  if (!a) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const sb = serviceClient()
  const c = await req.json().catch(() => ({})) as Record<string, unknown>
  const txt = (v: unknown) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, 120)
  const journal = (description: string) => logAudit({ acteur_id: a.id, type_action: 'EMPLOYE_MODIFIE', description, metadata: { postes: true }, ...ipEtAgent(req) })

  if (c.action === 'ajouter') {
    const nom = txt(c.nom), famille = txt(c.famille)
    if (!nom || !famille) return NextResponse.json({ error: 'Nom et famille obligatoires' }, { status: 400 })
    const { error } = await sb.from('postes').insert({ nom, famille, ordre: 100 })
    if (error) return NextResponse.json({ error: /duplicate|unique/i.test(error.message) ? 'Ce poste existe déjà' : error.message }, { status: 400 })
    await journal(`Poste ajouté à la liste officielle : ${nom} (${famille})`)
    return NextResponse.json({ ok: true })
  }

  if (c.action === 'modifier') {
    const { data: p } = await sb.from('postes').select('*').eq('id', String(c.id ?? '')).maybeSingle()
    if (!p) return NextResponse.json({ error: 'Poste introuvable' }, { status: 404 })
    const maj: Record<string, unknown> = {}
    if (c.nom !== undefined) { const n = txt(c.nom); if (!n) return NextResponse.json({ error: 'Nom obligatoire' }, { status: 400 }); maj.nom = n }
    if (c.famille !== undefined) { const f = txt(c.famille); if (!f) return NextResponse.json({ error: 'Famille obligatoire' }, { status: 400 }); maj.famille = f }
    if (typeof c.actif === 'boolean') maj.actif = c.actif
    const { error } = await sb.from('postes').update(maj).eq('id', p.id)
    if (error) return NextResponse.json({ error: /duplicate|unique/i.test(error.message) ? 'Ce poste existe déjà' : error.message }, { status: 400 })
    // Renommage : les fiches employés et le ciblage des politiques suivent
    if (maj.nom && maj.nom !== p.nom) {
      await sb.from('employes').update({ poste: maj.nom }).eq('poste', p.nom)
      const { data: pols } = await sb.from('politiques').select('id, postes').contains('postes', [p.nom])
      for (const pol of pols ?? []) await sb.from('politiques').update({ postes: (pol.postes as string[]).map(x => (x === p.nom ? maj.nom : x)) }).eq('id', pol.id)
    }
    await journal(`Poste modifié : ${p.nom}${maj.nom && maj.nom !== p.nom ? ` → ${maj.nom}` : ''}${maj.famille ? ` (famille : ${maj.famille})` : ''}${maj.actif === false ? ' — retiré de la liste' : maj.actif === true ? ' — remis dans la liste' : ''}`)
    return NextResponse.json({ ok: true })
  }

  if (c.action === 'correspondance') {
    const ancien = String(c.ancien ?? ''), nouveau = txt(c.nouveau)
    const postes = await chargerPostes(sb)
    if (!ancien || !postes.some(p => p.nom === nouveau)) return NextResponse.json({ error: 'Poste officiel inconnu' }, { status: 400 })
    const { data, error } = await filtrerEmployes(sb.from('employes').update({ poste: nouveau }).eq('poste', ancien), a).select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await journal(`Poste « ${ancien} » remplacé par « ${nouveau} » pour ${(data ?? []).length} employé(s)`)
    return NextResponse.json({ ok: true, employes: (data ?? []).length })
  }

  return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
}
