import { NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit'
import { getActeur, serviceClient, peutGererEmploye, ipEtAgent } from '@/lib/permissions'
import { aAccesAdmin } from '@/lib/cliniques'
import { inviterEmploye } from '@/lib/invitations'
import { origineDepuis } from '@/lib/courriels'

/** Renvoie un lien pour que l'employé (re)crée son mot de passe. */
export async function POST(request: Request) {
  const acteur = await getActeur()
  if (!acteur) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!aAccesAdmin(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { employeId } = await request.json()
  const sb = serviceClient()
  const { data: emp } = await sb.from('employes').select('*').eq('id', employeId).single()
  if (!emp || !peutGererEmploye(acteur, emp)) return NextResponse.json({ error: 'Employé introuvable' }, { status: 404 })
  if (emp.actif === false) return NextResponse.json({ error: 'Cet employé est archivé' }, { status: 400 })

  const inv = await inviterEmploye(sb, {
    email: emp.email, prenom: emp.prenom, nom: emp.nom, clinique: emp.clinique,
    origine: origineDepuis(request), nouveau: false,
  })
  if (!inv.authUserId) return NextResponse.json({ error: inv.erreur ?? 'Lien impossible à générer' }, { status: 400 })

  await logAudit({
    acteur_id: acteur.id,
    type_action: 'INVITATION_ENVOYEE',
    description: `Lien d'accès au portail ${inv.courrielEnvoye ? 'envoyé par courriel' : 'généré'} pour ${emp.prenom} ${emp.nom}`,
    cible_employe_id: emp.id,
    ...ipEtAgent(request),
  })

  return NextResponse.json({ success: true, courrielEnvoye: inv.courrielEnvoye, lienInvitation: inv.lien })
}
