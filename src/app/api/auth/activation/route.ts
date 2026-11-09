// Activation du compte (mot de passe choisi) : envoie les courriels « formation assignée » retenus
// pendant que le compte n'était pas encore activé. Un seul courriel, qui liste les formations à suivre.
import { NextResponse } from 'next/server'
import { serviceClient } from '@/lib/permissions'
import { origineDepuis } from '@/lib/courriels'
import { envoyerFormationsRetenues } from '@/lib/courriels-activation'

/** La session vient-elle d'un lien reçu par courriel (et non d'une connexion par mot de passe) ? */
function sessionParLien(jeton: string): boolean {
  try {
    const charge = JSON.parse(Buffer.from(jeton.split('.')[1] ?? '', 'base64url').toString('utf8')) as { amr?: { method?: string }[] }
    return (charge.amr ?? []).some(m => m.method === 'recovery' || m.method === 'otp')
  } catch { return false }
}

export async function POST(req: Request) {
  const jeton = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!jeton) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const sb = serviceClient()
  const { data: u } = await sb.auth.getUser(jeton)
  if (!u?.user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  // Mot de passe choisi depuis un lien reçu par courriel (session « recovery ») : il n'est plus temporaire
  if (u.user.app_metadata?.mdp_temporaire === true && sessionParLien(jeton)) {
    await sb.auth.admin.updateUserById(u.user.id, { app_metadata: { mdp_temporaire: false } })
  }
  return NextResponse.json({ envoyes: await envoyerFormationsRetenues(sb, u.user.id, origineDepuis(req)) })
}
