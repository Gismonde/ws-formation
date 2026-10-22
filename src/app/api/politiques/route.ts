import { NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit'
import { getActeur, serviceClient, ipEtAgent } from '@/lib/permissions'
import { peutPublierPolitiques, Politique, validerCiblage, colonnesRolesPostes, estPourToute } from '@/lib/politiques'
import { avertirPolitique } from '@/lib/politiques-courriels'
import { origineDepuis } from '@/lib/courriels'
import { estMediaPrive } from '@/lib/medias'

export async function POST(request: Request) {
  const acteur = await getActeur()
  if (!acteur || !peutPublierPolitiques(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const body = await request.json()
  const sb = serviceClient()

  const v = await validerCiblage(acteur, body, sb, await colonnesRolesPostes(sb))
  if ('erreur' in v) return NextResponse.json({ error: v.erreur }, { status: 400 })
  if (!estMediaPrive(body.fichier) || !String(body.fichier).startsWith('media:politiques/')) {
    return NextResponse.json({ error: 'Le document de la politique est obligatoire' }, { status: 400 })
  }

  const maintenant = new Date().toISOString()
  const { data: pol, error } = await sb.from('politiques').insert({
    ...v.valeurs,
    version: 1,
    fichier: body.fichier,
    nom_fichier: body.nom_fichier ?? null,
    publiee_le: maintenant,
    publiee_par: acteur.id,
    actif: true,
  }).select('*').single()
  if (error || !pol) return NextResponse.json({ error: error?.message ?? 'Erreur' }, { status: 500 })

  await sb.from('politiques_versions').insert({
    politique_id: pol.id, version: 1, fichier: pol.fichier, nom_fichier: pol.nom_fichier, publiee_le: maintenant, publiee_par: acteur.id,
  })

  await logAudit({
    acteur_id: acteur.id,
    type_action: 'POLITIQUE_PUBLIEE',
    description: `Politique publiée : ${pol.titre} (${pol.clinique}${estPourToute(pol) ? ', toute la clinique' : ', public ciblé'})`,
    metadata: { politique_id: pol.id, version: 1 },
    ...ipEtAgent(request),
  })

  let courriels = 0
  if (body.notifier !== false) courriels = (await avertirPolitique(sb, pol as Politique, origineDepuis(request), 'nouvelle')).envoyes

  return NextResponse.json({ success: true, id: pol.id, courriels })
}
