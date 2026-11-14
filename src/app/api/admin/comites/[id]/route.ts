// Comités. PATCH : modifier (textes, membres, publication). DELETE : supprimer le comité.
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, ipEtAgent } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { lireComite, peutGererComites, CLINIQUE_COMITES } from '@/lib/comites'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acteur = await getActeur()
  if (!peutGererComites(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const v = lireComite(await req.json().catch(() => ({})))
  if ('erreur' in v) return NextResponse.json({ error: v.erreur }, { status: 400 })
  const sb = serviceClient()
  const { data: avant } = await sb.from('comites').select('publie').eq('id', id).eq('clinique', CLINIQUE_COMITES).maybeSingle()
  if (!avant) return NextResponse.json({ error: 'Comité introuvable' }, { status: 404 })
  const { data, error } = await sb.from('comites').update({ ...v.valeurs, modifie_le: new Date().toISOString() }).eq('id', id).select('*').single()
  if (error) return NextResponse.json({ error: /image|incident/.test(error.message) ? 'Exécutez d’abord les dernières lignes de supabase/migrations/comites.sql (colonnes image et incident).' : error.message }, { status: 500 })
  const changement = avant.publie === data.publie ? 'modifié' : data.publie ? 'publié' : 'repassé en brouillon'
  await logAudit({ acteur_id: acteur!.id, type_action: 'PARAMETRE_MODIFIE', description: `Comité ${changement} : ${data.nom}`, metadata: { comite_id: id }, ...ipEtAgent(req) })
  return NextResponse.json({ comite: data })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acteur = await getActeur()
  if (!peutGererComites(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const sb = serviceClient()
  const { data, error } = await sb.from('comites').delete().eq('id', id).eq('clinique', CLINIQUE_COMITES).select('nom')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: 'Comité introuvable' }, { status: 404 })
  await logAudit({ acteur_id: acteur!.id, type_action: 'PARAMETRE_MODIFIE', description: `Comité supprimé : ${data[0].nom}`, metadata: { comite_id: id }, ...ipEtAgent(req) })
  return NextResponse.json({ ok: true })
}
