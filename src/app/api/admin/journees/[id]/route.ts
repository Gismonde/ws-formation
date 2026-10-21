// Supprime un modèle ou l'enregistrement d'une journée (les assignations déjà faites restent).
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, cliniquesContenuVisibles, ipEtAgent } from '@/lib/permissions'
import { peutGererJournees, lireJournee, CHAMPS_JOURNEE } from '@/lib/journees'
import { logAudit } from '@/lib/audit'
import { peutPublierPolitiques } from '@/lib/politiques'

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const acteur = await getActeur()
  if (!acteur || !peutGererJournees(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const { id } = await params
  const sb = serviceClient()
  const { data: j } = await sb.from('journees_formation').select('id, nom, modele, clinique').eq('id', id).maybeSingle()
  if (!j || !cliniquesContenuVisibles(acteur).includes(j.clinique)) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const { error } = await sb.from('journees_formation').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ acteur_id: acteur.id, type_action: 'PARAMETRE_MODIFIE', description: `${j.modele ? 'Modèle' : 'Journée'} de formation « ${j.nom} » supprimé(e)`, metadata: { journee_id: id }, ...ipEtAgent(req) })
  return NextResponse.json({ ok: true })
}

/** Met à jour un modèle (contenu, raison, nom, clinique, message). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const acteur = await getActeur()
  if (!acteur || !peutGererJournees(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const { id } = await params
  const sb = serviceClient()
  const { data: j } = await sb.from('journees_formation').select('id, modele, clinique').eq('id', id).maybeSingle()
  if (!j || !j.modele || !cliniquesContenuVisibles(acteur).includes(j.clinique)) return NextResponse.json({ error: 'Modèle introuvable' }, { status: 404 })
  const v = lireJournee({ ...(await req.json().catch(() => ({}))), modele: true }, cliniquesContenuVisibles(acteur))
  if ('erreur' in v) return NextResponse.json({ error: v.erreur }, { status: 400 })
  if (v.valeurs.politique_ids.length && !peutPublierPolitiques(acteur)) return NextResponse.json({ error: 'Les politiques sont gérées par les administrateurs.' }, { status: 403 })
  const { data, error } = await sb.from('journees_formation').update(v.valeurs).eq('id', id).select(CHAMPS_JOURNEE).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ acteur_id: acteur.id, type_action: 'PARAMETRE_MODIFIE', description: `Modèle de journée de formation « ${v.valeurs.nom} » modifié`, metadata: { journee_id: id }, ...ipEtAgent(req) })
  return NextResponse.json({ journee: data })
}
