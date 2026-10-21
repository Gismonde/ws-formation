// Librairie : liste (GET ?type=video|lien|document&archives=1) et ajout (POST).
import { NextRequest, NextResponse } from 'next/server'
import { getActeur, serviceClient, cliniquesContenuVisibles } from '@/lib/permissions'
import { CHAMPS_LIBRAIRIE, TYPES_LIBRAIRIE, peutVoirLibrairie, validerElement, utilisations, type ElementLibrairie, type TypeLibrairie } from '@/lib/librairie'
import { signerUrlsMedias } from '@/lib/medias-serveur'
import { logAudit } from '@/lib/audit'

const tableAbsente = (e: { code?: string; message: string }) => e.code === '42P01' || /librairie/.test(e.message)

export async function GET(req: NextRequest) {
  const acteur = await getActeur()
  if (!acteur || !peutVoirLibrairie(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const type = req.nextUrl.searchParams.get('type') as TypeLibrairie | null
  const archives = req.nextUrl.searchParams.get('archives') === '1'

  const sb = serviceClient()
  let q = sb.from('librairie').select(CHAMPS_LIBRAIRIE).in('clinique', cliniquesContenuVisibles(acteur)).order('titre')
  if (type && TYPES_LIBRAIRIE.includes(type)) q = q.eq('type', type)
  if (!archives) q = q.eq('archive', false)
  const { data, error } = await q
  if (error) {
    return NextResponse.json({ error: tableAbsente(error) ? 'Exécutez d’abord supabase/migrations/librairie.sql dans Supabase.' : error.message, migration: tableAbsente(error) }, { status: tableAbsente(error) ? 503 : 500 })
  }
  const elements = (data ?? []) as ElementLibrairie[]
  const usages = await utilisations(sb, elements.map(e => e.id))
  const liens = await signerUrlsMedias(elements.map(e => e.url))
  return NextResponse.json({
    elements: elements.map(e => ({ ...e, apercu: liens[e.url] ?? null, utilisations: usages.get(e.id) ?? [] })),
  })
}

export async function POST(req: Request) {
  const acteur = await getActeur()
  if (!acteur || !peutVoirLibrairie(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const v = validerElement(await req.json().catch(() => ({})), acteur)
  if ('erreur' in v) return NextResponse.json({ error: v.erreur }, { status: 400 })
  const sb = serviceClient()
  const { data, error } = await sb.from('librairie').insert({ ...v.valeurs, cree_par: acteur.id }).select(CHAMPS_LIBRAIRIE).single()
  if (error) return NextResponse.json({ error: tableAbsente(error) ? 'Exécutez d’abord supabase/migrations/librairie.sql dans Supabase.' : error.message }, { status: 500 })
  await logAudit({ acteur_id: acteur.id, type_action: 'PARAMETRE_MODIFIE', description: `Librairie : ajout de « ${v.valeurs.titre} »`, metadata: { librairie_id: data.id, type: v.valeurs.type } })
  return NextResponse.json({ element: data })
}
