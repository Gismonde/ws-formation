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
  return NextResponse.json({ notifications: await notificationsEmploye(sb, e, espace.actif) }, { headers: { 'Cache-Control': 'no-store' } })
}
