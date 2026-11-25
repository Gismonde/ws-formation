// POST { nom } : nouvelle catégorie générale pour les guides et consentements (Recherche, Nutrition…).
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, ipEtAgent } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { estAdminCommunications, lireNomTheme } from '@/lib/communications'

export async function POST(req: Request) {
  const acteur = await getActeur()
  if (!estAdminCommunications(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const lu = lireNomTheme((await req.json().catch(() => ({})))?.nom)
  if ('erreur' in lu) return NextResponse.json({ error: lu.erreur }, { status: 400 })
  const { data, error } = await serviceClient().from('themes_documents').insert({ nom: lu.nom }).select('id, nom').single()
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'Cette catégorie existe déjà.' : error.message }, { status: 400 })
  await logAudit({ acteur_id: acteur!.id, type_action: 'PARAMETRE_MODIFIE', description: `Catégorie de documents « ${data.nom} » créée`, ...ipEtAgent(req) })
  return NextResponse.json({ theme: data })
}
