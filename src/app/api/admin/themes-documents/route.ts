// POST { nom, parent_id? } : nouvelle catégorie (ou sous-catégorie) générale pour les guides et consentements (Recherche, Nutrition…).
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, ipEtAgent } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { estAdminCommunications, lireNomTheme, estUuid } from '@/lib/communications'

export async function POST(req: Request) {
  const acteur = await getActeur()
  if (!estAdminCommunications(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const corps = await req.json().catch(() => ({}))
  const lu = lireNomTheme(corps?.nom)
  if ('erreur' in lu) return NextResponse.json({ error: lu.erreur }, { status: 400 })
  const sb = serviceClient()
  const parent_id = estUuid(corps?.parent_id) ? corps.parent_id : null
  let parent: { nom: string } | null = null
  if (parent_id) {
    parent = (await sb.from('themes_documents').select('nom').eq('id', parent_id).maybeSingle()).data
    if (!parent) return NextResponse.json({ error: 'Catégorie parente introuvable' }, { status: 400 })
  }
  const { data, error } = await sb.from('themes_documents').insert({ nom: lu.nom, parent_id }).select('id, nom, parent_id').single()
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'Cette catégorie existe déjà à cet endroit.' : error.message }, { status: 400 })
  await logAudit({ acteur_id: acteur!.id, type_action: 'PARAMETRE_MODIFIE', description: parent ? `Sous-catégorie « ${data.nom} » créée dans « ${parent.nom} »` : `Catégorie de documents « ${data.nom} » créée`, ...ipEtAgent(req) })
  return NextResponse.json({ theme: data })
}
