// Inscription volontaire d'un employé à une formation en libre accès.
import { NextResponse } from 'next/server'
import { getActeur, serviceClient } from '@/lib/permissions'
import { getEspace } from '@/lib/espace'
import { logAudit } from '@/lib/audit'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const moi = await getActeur()
  if (!moi) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { id } = await params
  const sb = serviceClient()
  const { data: f } = await sb.from('formations').select('id, titre, clinique, publiee, libre_acces').eq('id', id).maybeSingle()
  const espace = await getEspace(moi)
  if (!f || !f.publiee || f.libre_acces !== true || !(espace.cliniquesContenu as string[]).includes(f.clinique)) {
    return NextResponse.json({ error: 'Formation non disponible' }, { status: 404 })
  }
  const { data: deja } = await sb.from('assignations').select('formation_id').eq('employe_id', moi.id).eq('formation_id', id).maybeSingle()
  if (!deja) {
    const ligne = { employe_id: moi.id, formation_id: id, assigne_par: moi.id, date_assignation: new Date().toISOString(), volontaire: true }
    let { error } = await sb.from('assignations').insert(ligne)
    if (error && /volontaire/.test(error.message)) {
      const { volontaire: _v, ...sans } = ligne; void _v
      ;({ error } = await sb.from('assignations').insert(sans))
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logAudit({ acteur_id: moi.id, formation_id: id, type_action: 'FORMATION_ASSIGNEE', description: `Inscription volontaire : « ${f.titre} »`, metadata: { volontaire: true } })
  }
  return NextResponse.json({ ok: true })
}
