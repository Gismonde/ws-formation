import { NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit'
import { getActeur, serviceClient, ipEtAgent } from '@/lib/permissions'
import { estVise, Politique, TEXTE_CONFIRMATION_POLITIQUE } from '@/lib/politiques'

/** L'employé confirme avoir lu et compris la version en vigueur de la politique. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acteur = await getActeur()
  if (!acteur) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })

  const { version, lu } = await request.json()
  if (lu !== true) return NextResponse.json({ error: 'Cochez « J’ai lu et compris »' }, { status: 400 })

  const sb = serviceClient()
  const { data } = await sb.from('politiques').select('*').eq('id', id).single()
  const pol = data as Politique | null
  if (!pol || !pol.actif || !estVise(pol, acteur)) return NextResponse.json({ error: 'Politique introuvable' }, { status: 404 })
  if (version !== pol.version) {
    return NextResponse.json({ error: 'Une nouvelle version vient d’être publiée. Rechargez la page pour la lire.' }, { status: 409 })
  }

  const { ip_address, user_agent } = ipEtAgent(request)
  const { error } = await sb.from('politiques_confirmations').insert({
    politique_id: id, version: pol.version, employe_id: acteur.id,
    texte: TEXTE_CONFIRMATION_POLITIQUE, ip_address, user_agent,
  })
  if (error && error.code !== '23505') return NextResponse.json({ error: error.message }, { status: 500 })

  if (!error) {
    await logAudit({
      acteur_id: acteur.id, cible_employe_id: acteur.id, type_action: 'POLITIQUE_CONFIRMEE',
      description: `Lu et compris : ${pol.titre} (v${pol.version})`,
      metadata: { politique_id: id, version: pol.version }, ip_address, user_agent,
    })
  }
  return NextResponse.json({ success: true })
}
