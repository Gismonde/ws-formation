// Un administrateur définit le mot de passe d'un employé (au besoin, ex. courriel d'invitation non reçu).
// Le mot de passe n'est ni conservé ni journalisé ; par défaut l'employé doit le remplacer à sa première connexion.
import { NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit'
import { getActeur, serviceClient, peutGererEmploye, ipEtAgent } from '@/lib/permissions'
import { aAccesAdmin } from '@/lib/cliniques'
import { regleMotDePasse, peutTransmettreAcces } from '@/lib/mot-de-passe'

export async function POST(request: Request) {
  const acteur = await getActeur()
  if (!acteur) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!aAccesAdmin(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const c = await request.json().catch(() => ({})) as { employeId?: string; motDePasse?: string; exigerChangement?: boolean }
  const sb = serviceClient()
  const { data: emp } = await sb.from('employes').select('*').eq('id', String(c.employeId ?? '')).maybeSingle()
  if (!emp || !peutGererEmploye(acteur, emp)) return NextResponse.json({ error: 'Employé introuvable' }, { status: 404 })
  if (emp.id !== acteur.id && !peutTransmettreAcces(acteur.role, emp.role, true)) return NextResponse.json({ error: 'Seul un administrateur peut définir le mot de passe de ce compte.' }, { status: 403 })
  if (emp.id === acteur.id) return NextResponse.json({ error: 'Changez votre propre mot de passe depuis Mon compte › Sécurité.' }, { status: 400 })
  if (emp.actif === false) return NextResponse.json({ error: 'Cet employé est archivé' }, { status: 400 })
  if (!emp.auth_user_id) return NextResponse.json({ error: 'Cet employé n’a pas de compte de connexion' }, { status: 400 })

  const mdp = String(c.motDePasse ?? '')
  const regle = regleMotDePasse(mdp)
  if (regle) return NextResponse.json({ error: regle }, { status: 400 })
  const exiger = c.exigerChangement !== false

  const { error } = await sb.auth.admin.updateUserById(emp.auth_user_id, {
    password: mdp, email_confirm: true, app_metadata: { mdp_temporaire: exiger },
  })
  if (error) return NextResponse.json({ error: /weak|pwned|leaked/i.test(error.message) ? 'Ce mot de passe est trop courant. Choisissez-en un autre.' : `Impossible d’enregistrer le mot de passe : ${error.message}` }, { status: 400 })

  // Les liens d'invitation encore ouverts ne servent plus
  await sb.from('invitations_employes').update({ annule_le: new Date().toISOString() }).eq('auth_user_id', emp.auth_user_id).is('utilise_le', null).is('annule_le', null)

  await logAudit({
    acteur_id: acteur.id,
    type_action: 'EMPLOYE_MODIFIE',
    description: `Mot de passe défini par un administrateur pour ${emp.prenom} ${emp.nom}${exiger ? ' (à remplacer à la première connexion)' : ''}`,
    cible_employe_id: emp.id,
    metadata: { mot_de_passe_defini: true, changement_exige: exiger },
    ...ipEtAgent(request),
  })
  return NextResponse.json({ success: true, exigerChangement: exiger })
}
