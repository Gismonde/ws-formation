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
    await demanderReinitialisation(serviceClient(), { email: c.email, origine: origineDepuis(req), ip: ip_address, agent: user_agent })
  } catch { /* même réponse, quoi qu'il arrive */ }
  // Durée minimale identique : le temps de réponse ne trahit pas l'existence du compte
  const reste = DUREE_MIN_MS - (Date.now() - debut)
  if (reste > 0) await new Promise(r => setTimeout(r, reste))
  return NextResponse.json({ ok: true })
}
