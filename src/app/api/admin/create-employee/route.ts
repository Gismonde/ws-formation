import { NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit'
import { getActeur, serviceClient, validerAttribution, ipEtAgent } from '@/lib/permissions'
import { aAccesAdmin, ROLE_LABEL } from '@/lib/cliniques'

export async function POST(request: Request) {
  const acteur = await getActeur()
  if (!acteur) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
  if (!aAccesAdmin(acteur.role)) return NextResponse.json({ error: 'Acces refuse' }, { status: 403 })

  const body = await request.json()
  const { prenom, nom, email, password, poste } = body

  if (!prenom || !nom || !email || !password) {
    return NextResponse.json({ error: 'Champs obligatoires manquants' }, { status: 400 })
  }

  const sb = serviceClient()
  const attribution = await validerAttribution(acteur, body, sb)
  if ('erreur' in attribution) return NextResponse.json({ error: attribution.erreur }, { status: 403 })
  const { role, clinique, departement_id } = attribution.valeurs

  const { data: newUser, error: authError } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { prenom, nom },
  })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  const { data: newEmp, error: empError } = await sb
    .from('employes')
    .insert({
      auth_user_id: newUser.user.id,
      prenom,
      nom,
      email,
      role,
      clinique,
      departement_id,
      poste: poste || null,
      peut_creer_formations: (acteur.role === 'super_admin' || acteur.role === 'admin') && role === 'gestionnaire' && body.peut_creer_formations === true,
      actif: true,
    })
    .select('id')
    .single()

  if (empError) {
    await sb.auth.admin.deleteUser(newUser.user.id)
    return NextResponse.json({ error: empError.message }, { status: 400 })
  }

  await logAudit({
    acteur_id: acteur.id,
    type_action: 'EMPLOYE_CREE',
    description: `Nouvel employe cree : ${prenom} ${nom} (${email}) — ${ROLE_LABEL[role]}${clinique ? ', ' + clinique : ''}`,
    cible_employe_id: newEmp?.id ?? null,
    metadata: { role, clinique, departement_id },
    ...ipEtAgent(request),
  })

  return NextResponse.json({ success: true, userId: newUser.user.id })
}
