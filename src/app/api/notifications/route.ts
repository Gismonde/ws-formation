// Notifications de l'employé connecté (cloche du portail).
import { NextResponse } from 'next/server'
import { getActeur, serviceClient } from '@/lib/permissions'
import { getEspace } from '@/lib/espace'
import { notificationsEmploye } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

export async function GET() {
  const acteur = await getActeur()
  if (!acteur) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const sb = serviceClient()
  const { data: e } = await sb.from('employes').select('id, clinique, role, departement_id, poste').eq('id', acteur.id).single()
  if (!e) return NextResponse.json({ notifications: [] })
  const espace = await getEspace(e)
  // Dernière ouverture de la cloche (tous appareils) ; colonne absente : l'appareil garde la sienne
  const { data: v, error } = await sb.from('employes').select('notifications_vues_le').eq('id', acteur.id).maybeSingle()
  return NextResponse.json({
    notifications: await notificationsEmploye(sb, e, espace.actif),
    vues_le: error ? undefined : ((v as { notifications_vues_le?: string | null } | null)?.notifications_vues_le ?? null),
  }, { headers: { 'Cache-Control': 'no-store' } })
}

/** La cloche a été ouverte : tout ce qui précède est lu, sur tous les appareils. */
export async function POST() {
  const acteur = await getActeur()
  if (!acteur) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const le = new Date().toISOString()
  const { error } = await serviceClient().from('employes').update({ notifications_vues_le: le }).eq('id', acteur.id)
  return NextResponse.json({ ok: !error, vues_le: le })
}
