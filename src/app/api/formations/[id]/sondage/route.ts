// Enregistrement de la réponse d'un employé au sondage de satisfaction d'une formation.
import { NextResponse } from 'next/server'
import { getActeur, serviceClient } from '@/lib/permissions'
import { etatSondage, validerReponse } from '@/lib/sondages'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: formationId } = await params
  const acteur = await getActeur()
  if (!acteur) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const sb = serviceClient()

  const { data: assignation } = await sb.from('assignations').select('id')
    .eq('employe_id', acteur.id).eq('formation_id', formationId).limit(1).maybeSingle()
  if (!assignation) return NextResponse.json({ error: 'Cette formation ne vous est pas assignée.' }, { status: 403 })

  const etat = await etatSondage(sb, acteur.id, formationId)
  if (etat === 'inactif') return NextResponse.json({ error: 'Le sondage n’est pas disponible pour cette formation.' }, { status: 404 })
  if (etat === 'repondu') return NextResponse.json({ error: 'Vous avez déjà répondu à ce sondage. Merci !' }, { status: 409 })
  if (etat === 'pas_encore') return NextResponse.json({ error: 'Terminez d’abord la formation.' }, { status: 400 })

  const v = validerReponse(await request.json().catch(() => null))
  if ('erreur' in v) return NextResponse.json({ error: v.erreur }, { status: 400 })

  const { error } = await sb.from('sondage_reponses').insert({ formation_id: formationId, employe_id: acteur.id, ...v.reponse })
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Vous avez déjà répondu à ce sondage. Merci !' }, { status: 409 })
    console.error('[Sondage] Enregistrement impossible', error)
    return NextResponse.json({ error: 'Enregistrement impossible, réessayez.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
