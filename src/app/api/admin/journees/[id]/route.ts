// Supprime un modèle ou l'enregistrement d'une journée (les assignations déjà faites restent).
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, cliniquesContenuVisibles, ipEtAgent } from '@/lib/permissions'
import { peutGererJournees } from '@/lib/journees'
import { logAudit } from '@/lib/audit'

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
