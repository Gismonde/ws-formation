// Invitation d'un employé : lien sécurisé pour créer son mot de passe (aucun mot de passe saisi par l'admin).
import { chargerNotifications, composerNotification } from '@/lib/notifications-courriel'
import type { SupabaseClient } from '@supabase/supabase-js'
import { envoyerCourriels, gabarit } from '@/lib/courriels'
import { randomBytes, createHash } from 'crypto'

export const empreinteJeton = (jeton: string) => createHash('sha256').update(jeton).digest('hex')

/**
 * Jeton d'invitation sans expiration (table invitations_employes) : valide jusqu'à son utilisation.
 * Les invitations précédentes non utilisées de la personne sont annulées. null si la table n'existe pas encore.
 */
async function creerJetonPermanent(sb: SupabaseClient, authUserId: string, email: string): Promise<string | null> {
  const jeton = randomBytes(32).toString('base64url')
  const maintenant = new Date().toISOString()
  const { error: errAnnul } = await sb.from('invitations_employes').update({ annule_le: maintenant }).eq('auth_user_id', authUserId).is('utilise_le', null).is('annule_le', null)
  if (errAnnul) return null
  const { error } = await sb.from('invitations_employes').insert({ auth_user_id: authUserId, email, jeton_hash: empreinteJeton(jeton) })
  return error ? null : jeton
}

export type ResultatInvitation = {
  authUserId: string | null
  courrielEnvoye: boolean
  /** Lien à transmettre manuellement si le courriel n'a pas pu partir */
  lien: string | null
  erreur?: string
}

/**
 * - nouveau = true  : crée le compte de connexion (type « invite »)
 * - nouveau = false : compte existant, nouveau lien pour (re)définir le mot de passe (type « recovery »)
 */
export async function inviterEmploye(sb: SupabaseClient, params: {
  email: string; prenom: string; nom: string; clinique: string | null; origine: string; nouveau: boolean
  /** Ne pas envoyer de courriel : seulement générer le lien (l'administrateur le transmet lui-même) */
  sansCourriel?: boolean
  /** Demande « Mot de passe oublié ? » faite par l'employé lui-même (texte du courriel adapté) */
  oubli?: boolean
}): Promise<ResultatInvitation> {
  const { email, prenom, nom, clinique, origine, nouveau, sansCourriel, oubli } = params
  const { data, error } = await sb.auth.admin.generateLink(nouveau
    ? { type: 'invite', email, options: { data: { prenom, nom } } }
    : { type: 'recovery', email })
  if (error || !data?.properties?.hashed_token) {
    return { authUserId: null, courrielEnvoye: false, lien: null, erreur: error?.message ?? 'Lien impossible à générer' }
  }
  const type = nouveau ? 'invite' : 'recovery'
  // Compte jamais activé (nouvel employé) : lien du portail sans expiration ; sinon lien Supabase (expire)
  const jamaisActive = nouveau || !data.user?.last_sign_in_at
  const permanent = jamaisActive && data.user?.id ? await creerJetonPermanent(sb, data.user.id, email) : null
  const lien = permanent
    ? `${origine}/bienvenue?invitation=${encodeURIComponent(permanent)}`
    : `${origine}/bienvenue?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=${type}${oubli ? '&oubli=1' : ''}`

  if (sansCourriel) return { authUserId: data.user?.id ?? null, courrielEnvoye: false, lien }
  const cfg = nouveau ? await chargerNotifications(sb) : null
  const perso = nouveau ? composerNotification(cfg, 'compte_cree_admin', { a: email, origine, clinique, prenom, nom, lien }) : null
  if (nouveau && !perso) {
    // Notification désactivée : aucun courriel, le lien est transmis par l'administrateur
    return { authUserId: data.user?.id ?? null, courrielEnvoye: false, lien, erreur: 'notification_desactivee' }
  }
  const { html, texte } = perso ? { html: perso.html, texte: perso.texte } : gabarit({
    origine, clinique,
    titre: nouveau ? `Bienvenue ${prenom} !` : oubli ? 'Réinitialisez votre mot de passe' : 'Accédez à votre portail de formation',
    paragraphes: nouveau
      ? [
          'Votre accès au portail de formation des employés vient d’être créé.',
          'Cliquez sur le bouton ci-dessous pour choisir votre mot de passe et activer votre compte. Vous y trouverez ensuite vos formations, vos certificats et les politiques de la clinique.',
          `Votre identifiant de connexion est : ${email}`,
        ]
      : oubli
        ? [
            `Bonjour ${prenom},`.replace(' ,', ','),
            'Vous avez demandé à réinitialiser votre mot de passe du portail de formation.',
            'Cliquez sur le bouton ci-dessous pour en choisir un nouveau.',
          ]
        : [
          `Bonjour ${prenom},`,
          'Voici un nouveau lien pour choisir votre mot de passe et accéder au portail de formation.',
        ],
    bouton: { libelle: nouveau ? 'Créer mon mot de passe' : oubli ? 'Choisir un nouveau mot de passe' : 'Choisir mon mot de passe', lien },
    piedDePage: permanent
      ? 'Ce lien est personnel : il reste valide jusqu’à ce que vous ayez choisi votre mot de passe. Ne le transférez pas.'
      : oubli
        ? 'Ce lien est personnel et expire rapidement. Si vous n’êtes pas à l’origine de cette demande, ignorez ce courriel : votre mot de passe actuel reste valide.'
        : 'Ce lien est personnel et expire rapidement. Si vous n’êtes pas à l’origine de cette demande, ignorez ce courriel.',
  })
  const envoi = await envoyerCourriels([{ a: email, sujet: perso ? perso.sujet : nouveau ? 'Activez votre accès au portail de formation' : oubli ? 'Réinitialisation de votre mot de passe — WS Formation' : 'Votre lien d’accès au portail de formation', html, texte }])
  const courrielEnvoye = envoi.envoyes === 1

  return {
    authUserId: data.user?.id ?? null,
    courrielEnvoye,
    lien: courrielEnvoye ? null : lien,
    erreur: courrielEnvoye ? undefined : envoi.erreur,
  }
}
