// Activation du compte (mot de passe choisi) : envoie les courriels « formation assignée » retenus
// pendant que le compte n'était pas encore activé. Un seul courriel, qui liste les formations à suivre.
import { NextResponse } from 'next/server'
import { serviceClient } from '@/lib/permissions'
import { origineDepuis } from '@/lib/courriels'
import { envoyerFormationsRetenues } from '@/lib/courriels-activation'

export async function POST(req: Request) {
  const jeton = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!jeton) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const sb = serviceClient()
  const { data: u } = await sb.auth.getUser(jeton)
  if (!u?.user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  return NextResponse.json({ envoyes: await envoyerFormationsRetenues(sb, u.user.id, origineDepuis(req)) })
}
