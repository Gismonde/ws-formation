// Lien d'invitation sans expiration (nouveaux employés).
//   POST { jeton, verifier: true }       → { valide, email } (affichage de la page)
//   POST { jeton, motDePasse }           → choisit le mot de passe, active le compte, consomme le lien
// Aucune session n'est ouverte : la personne se connecte ensuite avec son courriel et son mot de passe.
import { NextResponse } from 'next/server'
import { serviceClient } from '@/lib/permissions'
import { origineDepuis } from '@/lib/courriels'
import { empreinteJeton } from '@/lib/invitations'
import { envoyerFormationsRetenues } from '@/lib/courriels-activation'
import { logAudit } from '@/lib/audit'

const MIN = 10
function regle(pwd: string): string | null {
  if (pwd.length < MIN) return `Le mot de passe doit contenir au moins ${MIN} caractères.`
  if (!/[A-Z]/.test(pwd)) return 'Le mot de passe doit contenir au moins une lettre majuscule.'
  if (!/[a-z]/.test(pwd)) return 'Le mot de passe doit contenir au moins une lettre minuscule.'
  if (!/[0-9]/.test(pwd)) return 'Le mot de passe doit contenir au moins un chiffre.'
  return null
}

export async function POST(req: Request) {
  const c = await req.json().catch(() => ({})) as { jeton?: string; motDePasse?: string; verifier?: boolean }
  const jeton = String(c.jeton ?? '')
  if (jeton.length < 20 || jeton.length > 200) return NextResponse.json({ valide: false, error: 'Lien invalide.' }, { status: 400 })
  const sb = serviceClient()
  const { data: inv } = await sb.from('invitations_employes').select('id, auth_user_id, email, utilise_le, annule_le').eq('jeton_hash', empreinteJeton(jeton)).maybeSingle()
  const { data: emp } = inv ? await sb.from('employes').select('id, actif').eq('auth_user_id', inv.auth_user_id).maybeSingle() : { data: null }
  const raison = !inv ? 'invalide' : inv.utilise_le ? 'utilise' : inv.annule_le ? 'remplace' : !emp || emp.actif === false ? 'inactif' : null
  const messages: Record<string, string> = {
    invalide: 'Lien invalide. Demandez à votre gestionnaire de vous renvoyer l’invitation.',
    utilise: 'Ce lien a déjà été utilisé : votre compte est activé. Connectez-vous avec votre courriel et votre mot de passe (ou « Mot de passe oublié »).',
    remplace: 'Une invitation plus récente vous a été envoyée : utilisez le lien du dernier courriel reçu.',
    inactif: 'Ce compte n’est pas actif. Contactez votre gestionnaire.',
  }
  if (raison) return NextResponse.json({ valide: false, raison, error: messages[raison] }, { status: c.verifier ? 200 : 400 })
  if (c.verifier) return NextResponse.json({ valide: true, email: inv!.email })

  const mdp = String(c.motDePasse ?? '')
  const r = regle(mdp)
  if (r) return NextResponse.json({ error: r }, { status: 400 })
  const { error } = await sb.auth.admin.updateUserById(inv!.auth_user_id, { password: mdp, email_confirm: true })
  if (error) return NextResponse.json({ error: /weak|pwned|leaked/i.test(error.message) ? 'Ce mot de passe est trop courant. Choisissez-en un autre.' : `Impossible d’enregistrer le mot de passe : ${error.message}` }, { status: 400 })
  // Consommé une seule fois (garde contre deux envois simultanés)
  await sb.from('invitations_employes').update({ utilise_le: new Date().toISOString() }).eq('id', inv!.id).is('utilise_le', null)
  await logAudit({ acteur_id: emp!.id, type_action: 'INVITATION_ENVOYEE', description: 'Compte activé : mot de passe choisi depuis le lien d’invitation', cible_employe_id: emp!.id })
  try { await envoyerFormationsRetenues(sb, inv!.auth_user_id, origineDepuis(req)) } catch { /* sans gravité */ }
  return NextResponse.json({ ok: true, email: inv!.email })
}
