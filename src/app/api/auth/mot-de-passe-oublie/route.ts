// « Mot de passe oublié ? » — POST { email }. Réponse toujours identique (on ne révèle pas qui a un compte).
import { NextResponse } from 'next/server'
import { serviceClient, ipEtAgent } from '@/lib/permissions'
import { origineDepuis } from '@/lib/courriels'
import { demanderReinitialisation } from '@/lib/mot-de-passe-oublie'

const DUREE_MIN_MS = 900

export async function POST(req: Request) {
  const debut = Date.now()
  const c = await req.json().catch(() => ({})) as { email?: unknown }
  const { ip_address, user_agent } = ipEtAgent(req)
  try {
    const bilan = await demanderReinitialisation(serviceClient(), { email: c.email, origine: origineDepuis(req), ip: ip_address, agent: user_agent })
    // Journal Vercel (sans l'adresse) : envoye, inconnu, inactif, limite ou erreur
    console.info('[Mot de passe oublié]', bilan)
  } catch (e) {
    console.error('[Mot de passe oublié] erreur', e instanceof Error ? e.message : e) /* même réponse, quoi qu'il arrive */
  }
  // Durée minimale identique : le temps de réponse ne trahit pas l'existence du compte
  const reste = DUREE_MIN_MS - (Date.now() - debut)
  if (reste > 0) await new Promise(r => setTimeout(r, reste))
  return NextResponse.json({ ok: true })
}
