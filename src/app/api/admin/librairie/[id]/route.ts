// Librairie : modifier (PATCH, y compris archiver / désarchiver) ou supprimer (DELETE, si inutilisé).
import { NextResponse } from 'next/server'
import { getActeur, serviceClient } from '@/lib/permissions'
import { CHAMPS_LIBRAIRIE, peutGererLibrairie, validerElement, utilisations, propagerAuxBlocs, type ElementLibrairie } from '@/lib/librairie'
import { logAudit } from '@/lib/audit'

async function charger(id: string) {
  const { data } = await serviceClient().from('librairie').select(CHAMPS_LIBRAIRIE).eq('id', id).maybeSingle()
  return data as ElementLibrairie | null
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acteur = await getActeur()
  const avant = await charger(id)
  if (!avant) return NextResponse.json({ error: 'Élément introuvable' }, { status: 404 })
  if (!peutGererLibrairie(acteur, avant.clinique)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const corps = await req.json().catch(() => ({}))
  const sb = serviceClient()

  // Archiver / désarchiver seulement
  if (Object.keys(corps).length === 1 && typeof corps.archive === 'boolean') {
    const { error } = await sb.from('librairie').update({ archive: corps.archive, modifie_le: new Date().toISOString() }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const v = validerElement(corps, acteur!, avant)
  if ('erreur' in v) return NextResponse.json({ error: v.erreur }, { status: 400 })
  const { data, error } = await sb.from('librairie').update({ ...v.valeurs, modifie_le: new Date().toISOString() }).eq('id', id).select(CHAMPS_LIBRAIRIE).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const apres = data as ElementLibrairie
  const blocs = (avant.url !== apres.url || avant.titre !== apres.titre || avant.nom_fichier !== apres.nom_fichier) ? await propagerAuxBlocs(sb, avant, apres) : 0
  await logAudit({ acteur_id: acteur!.id, type_action: 'PARAMETRE_MODIFIE', description: `Librairie : « ${apres.titre} » modifié${blocs ? ` (${blocs} leçon(s) mise(s) à jour)` : ''}`, metadata: { librairie_id: id, blocs } })
  return NextResponse.json({ element: apres, blocsMisAJour: blocs })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acteur = await getActeur()
  const el = await charger(id)
  if (!el) return NextResponse.json({ error: 'Élément introuvable' }, { status: 404 })
  if (!peutGererLibrairie(acteur, el.clinique)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const sb = serviceClient()
  const u = (await utilisations(sb, [id])).get(id) ?? []
  if (u.length) return NextResponse.json({ error: `Utilisé dans ${u.length} leçon(s) : archivez-le plutôt.` }, { status: 409 })
  const { error } = await sb.from('librairie').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ acteur_id: acteur!.id, type_action: 'PARAMETRE_MODIFIE', description: `Librairie : suppression de « ${el.titre} »`, metadata: { librairie_id: id } })
  return NextResponse.json({ ok: true })
}
