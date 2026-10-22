import { NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit'
import { getActeur, serviceClient, validerAttribution, ipEtAgent } from '@/lib/permissions'
import { aAccesAdmin, ROLE_LABEL } from '@/lib/cliniques'
import { inviterEmploye } from '@/lib/invitations'
import { origineDepuis } from '@/lib/courriels'
import { droitsAEnregistrer, AUCUN_DROIT, changementsDroits } from '@/lib/droits'

export async function POST(request: Request) {
  const acteur = await getActeur()
  if (!acteur) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!aAccesAdmin(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const body = await request.json()
  const { prenom, nom, poste } = body
  const email = String(body.email ?? '').trim().toLowerCase()

  if (!prenom || !nom || !email) {
    return NextResponse.json({ error: 'Champs obligatoires manquants' }, { status: 400 })
  }

  const sb = serviceClient()
  const attribution = await validerAttribution(acteur, body, sb)
  if ('erreur' in attribution) return NextResponse.json({ error: attribution.erreur }, { status: 403 })
  const { role, clinique, departement_id } = attribution.valeurs

  // Compte de connexion créé sans mot de passe : l'employé le choisit via le lien d'invitation
  const invitation = await inviterEmploye(sb, { email, prenom, nom, clinique, origine: origineDepuis(request), nouveau: true })
  if (!invitation.authUserId) {
    const msg = /already|registered|exists/i.test(invitation.erreur ?? '') ? 'Un compte existe déjà avec ce courriel.' : (invitation.erreur ?? 'Création du compte impossible')
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  const authUserId = invitation.authUserId

  const { data: newEmp, error: empError } = await sb
    .from('employes')
    .insert({
      auth_user_id: authUserId,
      prenom,
      nom,
      email,
      role,
      clinique,
      departement_id,
      poste: poste || null,
      ...((acteur.role === 'super_admin' || acteur.role === 'admin') ? droitsAEnregistrer(role, body) : AUCUN_DROIT),
      actif: true,
    })
    .select('id')
    .single()

  if (empError) {
    await sb.auth.admin.deleteUser(authUserId)
    return NextResponse.json({ error: empError.message }, { status: 400 })
  }

  await logAudit({
    acteur_id: acteur.id,
    type_action: 'EMPLOYE_CREE',
    description: `Nouvel employé créé : ${prenom} ${nom} (${email}) — ${ROLE_LABEL[role]}${clinique ? ', ' + clinique : ''}`,
    cible_employe_id: newEmp?.id ?? null,
    metadata: { role, clinique, departement_id, invitation_envoyee: invitation.courrielEnvoye, droits: changementsDroits(AUCUN_DROIT, (acteur.role === 'super_admin' || acteur.role === 'admin') ? droitsAEnregistrer(role, body) : AUCUN_DROIT) },
    ...ipEtAgent(request),
  })

  return NextResponse.json({
    success: true,
    userId: authUserId,
    employeId: newEmp?.id ?? null,
    courrielEnvoye: invitation.courrielEnvoye,
    lienInvitation: invitation.lien,
  })
}
