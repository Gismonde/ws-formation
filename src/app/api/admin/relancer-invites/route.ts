// POST { ids: [...] } (20 au plus par appel) : renvoie le courriel d'activation aux employés
// invités qui n'ont pas encore activé leur compte. Les autres (déjà activés, jamais invités, archivés,
// hors de la portée de l'administrateur) sont ignorés : le serveur revérifie l'état de chacun.
import { NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit'
import { getActeur, serviceClient, peutGererEmploye, ipEtAgent } from '@/lib/permissions'
import { aAccesAdmin } from '@/lib/cliniques'
import { inviterEmploye } from '@/lib/invitations'
import { origineDepuis } from '@/lib/courriels'
import { etatsAcces } from '@/lib/acces-employes'

export const maxDuration = 60

export async function POST(req: Request) {
  const acteur = await getActeur()
  if (!acteur) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!aAccesAdmin(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const { ids } = await req.json().catch(() => ({})) as { ids?: unknown }
  const demandes = (Array.isArray(ids) ? ids : []).filter((x): x is string => typeof x === 'string').slice(0, 20)
  if (demandes.length === 0) return NextResponse.json({ envoyes: 0, ignores: 0, erreurs: [] })

  const sb = serviceClient()
  const { data } = await sb.from('employes').select('*').in('id', demandes)
  const emps = (data ?? []).filter(e => e.actif !== false && e.email && peutGererEmploye(acteur, e))
  const etats = await etatsAcces(sb, emps)
  const aRelancer = emps.filter(e => etats.get(e.id)?.etat === 'invite')
  const origine = origineDepuis(req)
  let envoyes = 0
  const erreurs: string[] = []
  for (const e of aRelancer) {
    const inv = await inviterEmploye(sb, { email: e.email, prenom: e.prenom, nom: e.nom, clinique: e.clinique, origine, nouveau: false })
    if (!inv.courrielEnvoye) { erreurs.push(`${e.prenom ?? ''} ${e.nom ?? ''}`.trim() + ' : ' + (inv.erreur ?? 'courriel non envoyé')); continue }
    envoyes++
    await logAudit({
      acteur_id: acteur.id, type_action: 'INVITATION_ENVOYEE',
      description: `Relance : lien d'accès au portail envoyé par courriel pour ${e.prenom} ${e.nom}`,
      cible_employe_id: e.id, metadata: { courriel: true, relance: true }, ...ipEtAgent(req),
    })
  }
  return NextResponse.json({ envoyes, ignores: demandes.length - aRelancer.length, erreurs })
}
